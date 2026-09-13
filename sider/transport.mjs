// HTTP transport for the Sider API.
//
// Node's built-in fetch is rejected by Sider's Cloudflare edge (different TLS
// fingerprint), so every request goes through curl.exe, which Windows ships and
// which also streams Server-Sent Events cleanly.
import { execFileSync, spawn } from "node:child_process";

export const HEADERS = {
  "x-app-name": "ChitChat_Web",
  "x-app-version": "1.0.0",
  "x-tz-name": process.env.SIDER_TZ || "Asia/Shanghai",
};

let cachedProxy;

/**
 * Sider is unreachable directly from mainland China, so every request needs the
 * local VPN proxy. Prefer an explicit override, fall back to the standard env
 * vars, then read the Windows "Internet Settings" proxy.
 */
export function detectProxy() {
  if (cachedProxy !== undefined) return cachedProxy;
  const explicit = process.env.SIDER_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy;
  if (explicit) {
    cachedProxy = explicit;
    return cachedProxy;
  }
  try {
    const out = execFileSync(
      "reg.exe",
      [
        "query",
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
        "/v",
        "ProxyServer",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const m = out.match(/ProxyServer\s+REG_SZ\s+(\S+)/);
    const value = m?.[1];
    // Only trust it when the proxy is actually switched on.
    const enabled = execFileSync(
      "reg.exe",
      [
        "query",
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
        "/v",
        "ProxyEnable",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    cachedProxy = /ProxyEnable\s+REG_DWORD\s+0x1/.test(enabled) && value ? `http://${value}` : null;
  } catch {
    cachedProxy = null;
  }
  return cachedProxy;
}

/** Build the -H arguments curl expects, merging cookies and extra headers. */
function headerArgs(headers) {
  const args = [];
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined || v === null || v === "") continue;
    args.push("-H", `${k}: ${v}`);
  }
  return args;
}

/** Common curl flags: quiet, follow redirects, and route through the VPN. */
function baseArgs() {
  const args = ["-sS", "-L"];
  const proxy = detectProxy();
  if (proxy) args.push("--proxy", proxy);
  return args;
}

/**
 * Perform a buffered request and return the parsed body plus status.
 * `fields` becomes multipart form-data; `json` becomes an application/json body.
 */
export function request({ url, method = "GET", headers = {}, json, fields, body }) {
  return new Promise((resolve, reject) => {
    const args = [...baseArgs(), "-X", method, "-w", "\n%{http_code}", ...headerArgs(headers)];

    if (fields) {
      for (const [name, value] of Object.entries(fields)) {
        if (value && typeof value === "object" && value.path !== undefined) {
          args.push("-F", `${name}=@${value.path}${value.type ? `;type=${value.type}` : ""}`);
        } else if (value !== undefined && value !== null) {
          args.push("-F", `${name}=${value}`);
        }
      }
    } else if (json !== undefined) {
      args.push("-H", "content-type: application/json", "--data-binary", "@-");
    } else if (body !== undefined) {
      args.push("--data-binary", "@-");
    }

    args.push(url);

    const child = spawn("curl.exe", args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`curl exited ${code}: ${err.trim()}`));
        return;
      }
      const cut = out.lastIndexOf("\n");
      const status = Number(out.slice(cut + 1).trim());
      const text = out.slice(0, cut);
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        /* leave data null for non-JSON responses */
      }
      resolve({ status, text, data });
    });

    if (json !== undefined) child.stdin.end(JSON.stringify(json), "utf8");
    else if (body !== undefined) child.stdin.end(body);
    else child.stdin.end();
  });
}

/**
 * POST a Server-Sent Events request, invoking `onEvent({ event, data })` for
 * every event curl emits. Resolves once the stream closes.
 */
export function stream({ url, headers = {}, json, onEvent, signal }) {
  return new Promise((resolve, reject) => {
    const args = [...baseArgs(), "-N", "-X", "POST", ...headerArgs(headers)];
    if (json !== undefined) args.push("-H", "content-type: application/json", "--data-binary", "@-");
    args.push(url);

    const child = spawn("curl.exe", args, { stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "";
    let raw = "";
    let sawEvent = false;
    let err = "";

    const flush = () => {
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const raw of events) {
        const parsed = parseEvent(raw);
        if (parsed) {
          sawEvent = true;
          onEvent(parsed);
        }
      }
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      raw += chunk;
      buffer += chunk;
      flush();
    });
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (buffer.trim()) {
        const parsed = parseEvent(buffer);
        if (parsed) {
          sawEvent = true;
          onEvent(parsed);
        }
      }
      // A non-SSE response (validation error, Cloudflare challenge, ...) never
      // produces events, so surface it as one instead of silently returning.
      if (!sawEvent && raw.trim()) {
        let data = raw;
        try {
          data = JSON.parse(raw);
        } catch {
          /* keep the raw text */
        }
        onEvent({ event: "error", data, raw });
      }
      if (code !== 0) reject(new Error(`curl exited ${code}: ${err.trim()}`));
      else resolve();
    });

    if (signal) {
      signal.addEventListener("abort", () => {
        child.kill();
        resolve();
      });
    }

    if (json !== undefined) child.stdin.end(JSON.stringify(json), "utf8");
    else child.stdin.end();
  });
}

function parseEvent(raw) {
  const lines = raw.split(/\r?\n/);
  let event = "message";
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
  }
  if (!dataLines.length) return null;
  const text = dataLines.join("\n");
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { event, data, raw: text };
}

/** Download a binary file to disk; returns the HTTP status and byte count. */
export function download({ url, headers = {}, outPath }) {
  return new Promise((resolve, reject) => {
    const args = [...baseArgs(), "-o", outPath, "-w", "%{http_code} %{size_download}", ...headerArgs(headers), url];
    const child = spawn("curl.exe", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`curl exited ${code}: ${err.trim()}`));
        return;
      }
      const [status, size] = out.trim().split(/\s+/).map(Number);
      resolve({ status, size });
    });
  });
}
