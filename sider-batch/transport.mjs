// HTTP transport for the Sider API.
//
// Node's built-in fetch is rejected by Sider's Cloudflare edge (different TLS
// fingerprint), so every request goes through curl.exe, which Windows ships and
// which also streams Server-Sent Events cleanly.
//
// 网络这块踩过的坑：sider.ai 在国内必须走代理，而「代理没探测到」时 curl 会直接连
// sider.ai，21 秒后报 `curl (28) Failed to connect to sider.ai port 443`，看上去像
// 服务器挂了，其实只是没走代理。所以这里做了三层兜底：
//   1. 探测代理时容忍 `http=127.0.0.1:7890;https=127.0.0.1:7891` 这类写法；
//   2. 没探测到就自动扫一遍常见本地代理端口（Clash / V2Ray…），并用真实请求筛出能到
//      sider.ai 的那个；
//   3. 连接类失败（curl 7 / 28）会换代理重试，最后给出说人话的错误提示。
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** 手动指定的代理会写在这里（管理台的「网络诊断」里可以设置），优先级高于系统代理。 */
export const PROXY_FILE = path.join(HERE, ".proxy");
const PROXY_TTL_MS = 15000;
const DISCOVERY_TTL_MS = 120000;
const DEV_NULL = process.platform === "win32" ? "NUL" : "/dev/null";
const CONNECT_TIMEOUT_S = 15;

/** 常见本地代理端口：Clash / Mihomo、V2Ray(N)、Privoxy 之类。 */
export const COMMON_PROXY_PORTS = [7890, 7891, 7892, 7897, 7898, 7899, 10808, 10809, 1080, 20171, 2080, 8118, 8889];

export const HEADERS = {
  "x-app-name": "ChitChat_Web",
  "x-app-version": "1.0.0",
  "x-tz-name": process.env.SIDER_TZ || "Asia/Shanghai",
};

let cachedProxy;
let cachedAt = 0;
let discovered = null; // { proxy, at }
let lastFailure = null;

function cacheProxy(value) {
  cachedProxy = value || null;
  cachedAt = Date.now();
  return cachedProxy;
}

/** 把各种写法的代理地址统一成 curl 能吃的 URL。 */
function normalizeProxy(value) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return null;
  // 注册表里可能是 "http=127.0.0.1:7890;https=127.0.0.1:7891" 这种按协议分列的写法
  if (raw.includes("=")) {
    const map = {};
    raw.split(";").forEach((pair) => {
      const at = pair.indexOf("=");
      if (at === -1) return;
      map[pair.slice(0, at).trim().toLowerCase()] = pair.slice(at + 1).trim();
    });
    const picked = map.https || map.http || map.socks5 || map.socks || Object.values(map)[0];
    return normalizeProxy(picked);
  }
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
}

function envProxy() {
  return normalizeProxy(process.env.SIDER_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy);
}

/** 管理台「网络诊断」里手动保存的代理。 */
export function fileProxy() {
  try {
    return normalizeProxy(fs.readFileSync(PROXY_FILE, "utf8"));
  } catch {
    return null;
  }
}

/** 读 Windows「Internet 设置」里的系统代理。 */
export function systemProxy() {
  try {
    const key = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
    const query = (name) =>
      execFileSync("reg.exe", ["query", key, "/v", name], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    const server = query("ProxyServer").match(/ProxyServer\s+REG_SZ\s+(\S+)/)?.[1];
    // Only trust it when the proxy is actually switched on.
    const enabled = /ProxyEnable\s+REG_DWORD\s+0x1/.test(query("ProxyEnable"));
    return enabled ? normalizeProxy(server) : null;
  } catch {
    return null;
  }
}

/** 不用自动扫描时能立刻拿到的那几处：环境变量 → 手动保存 → 系统代理。 */
export function staticProxy() {
  return envProxy() || fileProxy() || systemProxy();
}

/**
 * Sider is unreachable directly from mainland China, so every request needs the
 * local VPN proxy. Prefer an explicit override, fall back to the standard env
 * vars / saved file, then read the Windows "Internet Settings" proxy.
 *
 * 结果只缓存 15 秒：VPN 换端口、或者管理台比 VPN 先启动时，下一次请求就会重新探测，
 * 不用重启进程。
 */
export function detectProxy(force) {
  if (force) return refreshProxy();
  if (cachedProxy !== undefined && Date.now() - cachedAt < PROXY_TTL_MS) return cachedProxy;
  return cacheProxy(staticProxy());
}

/** 忽略缓存重新探测：环境变量 → 系统代理 → 手动保存的代理。 */
export function refreshProxy() {
  return cacheProxy(envProxy() || systemProxy() || fileProxy());
}

/** 手动指定代理（传空值表示清除），会持久化到 sider-batch/.proxy。 */
export function setProxy(value) {
  const v = value ? normalizeProxy(value) || String(value).trim() : "";
  try {
    if (v) fs.writeFileSync(PROXY_FILE, v + "\n", "utf8");
    else fs.rmSync(PROXY_FILE, { force: true });
  } catch {
    /* 写不进去也不影响本次运行 */
  }
  discovered = null;
  return v ? cacheProxy(v) : refreshProxy();
}

export function tcpOpen(port, host = "127.0.0.1", timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

/** 代理能不能真的连到 sider.ai：发一个便宜的 HEAD 请求看有没有拿到状态码。 */
export function probeProxy(proxy, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve) => {
    const seconds = String(Math.max(2, Math.ceil(timeoutMs / 1000)));
    const args = [
      "-sS", "-o", DEV_NULL, "-w", "%{http_code}",
      "--proxy", proxy,
      "--connect-timeout", seconds, "--max-time", seconds,
      "-I", "https://sider.ai/",
    ];
    const child = spawn("curl.exe", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const started = Date.now();
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => resolve({ ok: false, proxy, ms: Date.now() - started, err: String(e.message || e) }));
    child.on("close", (code) => {
      const httpCode = Number(String(out).trim()) || 0;
      resolve({
        ok: code === 0 && httpCode > 0,
        proxy,
        code,
        httpCode,
        ms: Date.now() - started,
        err: err.trim(),
      });
    });
  });
}

function portOf(proxy) {
  const m = /:(\d+)\/?$/.exec(String(proxy || "").trim());
  return m ? Number(m[1]) : null;
}

/**
 * 手动保存的代理 / 系统代理都读不到（或者读到了但连不通）时，扫一遍常见本地代理端口，
 * 用真实请求筛出能到 sider.ai 的那个。结果缓存 2 分钟。
 */
export async function discoverProxy({ force = false, skip = [] } = {}) {
  if (!force && discovered && Date.now() - discovered.at < DISCOVERY_TTL_MS) return discovered.proxy;
  const skipSet = new Set(skip.map((p) => portOf(p)).filter(Boolean));
  const ports = COMMON_PROXY_PORTS.filter((p) => !skipSet.has(p));
  const listening = [];
  await Promise.all(ports.map(async (p) => {
    if (await tcpOpen(p)) listening.push(p);
  }));
  listening.sort((a, b) => a - b);
  for (const port of listening) {
    const proxy = `http://127.0.0.1:${port}`;
    const res = await probeProxy(proxy);
    if (res.ok) {
      discovered = { proxy, at: Date.now() };
      return proxy;
    }
  }
  discovered = { proxy: null, at: Date.now() };
  return null;
}

/** 给「网络诊断」用的一份快照。 */
export function proxyInfo() {
  return {
    current: detectProxy(),
    system: systemProxy(),
    env: envProxy(),
    file: fileProxy(),
    filePath: PROXY_FILE,
    discovered: discovered ? discovered.proxy : null,
    discoveredAt: discovered ? discovered.at : null,
    autoPorts: COMMON_PROXY_PORTS.slice(),
    lastFailure,
  };
}

/** 最近一次连接失败的原因（给管理台显示用）。 */
export function lastFailureInfo() {
  return lastFailure;
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
function baseArgs(proxy) {
  const args = ["-sS", "-L", "--connect-timeout", String(CONNECT_TIMEOUT_S)];
  if (proxy) args.push("--proxy", proxy);
  return args;
}

/** 连不上时（curl 7 / 28）才算「代理问题」，业务错误不重试。 */
function isConnectError(code) {
  return code === 7 || code === 28;
}

/** 把 curl 的退出码翻译成人能看懂的一句话。 */
function explain(res, proxy, url) {
  const detail = String(res.err || "").trim();
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  if (isConnectError(res.code)) {
    if (!proxy) {
      return (
        `连不上 ${host}：这次请求没有走代理（直连被墙，curl 退出码 ${res.code}）。\n` +
        "请先在 Clash / VPN 里打开「系统代理」，再到管理台「出图返修 → 网络诊断」点「重新检测」；" +
        "如果 VPN 的端口不是 7890 / 7899 这些常见端口，就在那里手动填一次代理地址。\n" +
        `curl 原话：${detail}`
      );
    }
    return (
      `连不上 ${host}：代理 ${proxy} 没有转发成功（curl 退出码 ${res.code}）。\n` +
      "检查 VPN 是否还在运行、节点是否可用；换一个代理端口可以在「出图返修 → 网络诊断」里手动指定。\n" +
      `curl 原话：${detail}`
    );
  }
  if (res.code === 35 || res.code === 56) {
    return (
      `连上了 ${host} 但 TLS / 隧道没建立起来（curl 退出码 ${res.code}），多半还是代理不稳。\n` +
      `curl 原话：${detail}`
    );
  }
  return `curl 退出码 ${res.code}：${detail}`;
}

function rememberFailure(res, proxy, url) {
  lastFailure = {
    code: res.code,
    err: String(res.err || "").trim().slice(0, 400),
    proxy: proxy || null,
    url,
    at: Date.now(),
  };
  return lastFailure;
}

/**
 * 统一的「带代理重试」外壳：
 *   第一次用当前代理 → 失败就重新探测系统代理 → 再失败就自动扫本地代理端口，
 * 每一步都只对「连接类错误」重试（业务错误直接抛出，避免重复提交）。
 */
async function attemptWithProxies(run, { url, retryable } = {}) {
  const tried = [];
  let proxy = detectProxy();
  let last = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (proxy) tried.push(proxy);
    const res = await run(proxy);
    if (res.code === 0) return res;
    last = res;
    if (!isConnectError(res.code)) break;
    if (retryable && !retryable(res)) break;

    let next = refreshProxy();
    if (!next || tried.indexOf(next) > -1) next = await discoverProxy({ skip: tried });
    if (!next || tried.indexOf(next) > -1) {
      // 没有新代理可换了：把最后试过的那个再试一次，扛过偶发抖动。
      // 直连（没有代理）不重试——国内直连必然超时，再等一轮没意义。
      if (attempt === 0 && proxy) {
        last = await run(proxy);
        if (last.code === 0) return last;
      }
      break;
    }
    proxy = next;
  }

  rememberFailure(last, proxy, url);
  throw new Error(explain(last, proxy, url));
}

function runRequest({ url, method = "GET", headers = {}, json, fields, body, proxy }) {
  return new Promise((resolve, reject) => {
    const args = [...baseArgs(proxy), "-X", method, "-w", "\n%{http_code}", ...headerArgs(headers)];

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
        resolve({ code, err });
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
      resolve({ code: 0, status, text, data });
    });

    if (json !== undefined) child.stdin.end(JSON.stringify(json), "utf8");
    else if (body !== undefined) child.stdin.end(body);
    else child.stdin.end();
  });
}

/**
 * Perform a buffered request and return the parsed body plus status.
 * `fields` becomes multipart form-data; `json` becomes an application/json body.
 * 连不上时（curl 7/28）会换代理重试。
 */
export async function request(opts) {
  const res = await attemptWithProxies((proxy) => runRequest({ ...opts, proxy }), { url: opts.url });
  return { status: res.status, text: res.text, data: res.data };
}

/** 单次 SSE 请求；返回 curl 退出码，由上层决定是否重试。 */
function runStream({ url, headers = {}, json, onEvent, signal, proxy }) {
  return new Promise((resolve, reject) => {
    const args = [...baseArgs(proxy), "-N", "-X", "POST", ...headerArgs(headers)];
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
      if (code !== 0) resolve({ code, err, sawEvent });
      else resolve({ code: 0, sawEvent });
    });

    if (signal) {
      signal.addEventListener("abort", () => {
        child.kill();
        resolve({ code: 0, aborted: true });
      });
    }

    if (json !== undefined) child.stdin.end(JSON.stringify(json), "utf8");
    else child.stdin.end();
  });
}

/**
 * POST a Server-Sent Events request, invoking `onEvent({ event, data })` for
 * every event curl emits. Resolves once the stream closes.
 * 只有在「一个事件都还没收到」时才会因为连不上而换代理重试，避免重复触发回调。
 */
export async function stream(opts) {
  await attemptWithProxies((proxy) => runStream({ ...opts, proxy }), {
    url: opts.url,
    retryable: (res) => !res.sawEvent,
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

/** 单次下载；返回 curl 退出码，由上层决定是否重试。 */
function runDownload({ url, headers = {}, outPath, proxy }) {
  return new Promise((resolve, reject) => {
    const args = [...baseArgs(proxy), "-o", outPath, "-w", "%{http_code} %{size_download}", ...headerArgs(headers), url];
    const child = spawn("curl.exe", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ code, err });
        return;
      }
      const [status, size] = out.trim().split(/\s+/).map(Number);
      resolve({ code: 0, status, size });
    });
  });
}

/** Download a binary file to disk; returns the HTTP status and byte count. */
export async function download(opts) {
  const res = await attemptWithProxies((proxy) => runDownload({ ...opts, proxy }), { url: opts.url });
  return { status: res.status, size: res.size };
}
