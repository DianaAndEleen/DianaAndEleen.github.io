#!/usr/bin/env node
// Sider image-generation client.
//
// Reverse-engineered from the web app's own traffic; see README.md for how the
// endpoints were identified. Requires a logged-in `token` in .credentials.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HEADERS, detectProxy, download, request, stream } from "./transport.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = "https://sider.ai/api";
const CREATE_API = `${API}/create`;

export const MODELS = {
  "gpt-image-2": { name: "GPT Image 2", credit: 2, quality: { low: 2, medium: 5, high: 20 } },
  "gpt-image-2.5-sunburst": { name: "GPT Image 2.5 Sunburst", quality: 5 },
  "gpt-image-2.5-flare": { name: "GPT Image 2.5 Flare", quality: 5 },
  "gemini-2.5-flash-image": { name: "Nano Banana", credit: 5 },
  "gemini-3.1-flash-lite-image": { name: "Nano Banana 2 Lite", credit: 4 },
  "gemini-3.1-flash-image-preview": { name: "Nano Banana 2", credit: 8 },
  "gemini-3-pro-image-preview": { name: "Nano Banana Pro", credit: 15 },
  "doubao-seedream-4-0-250828": { name: "Seedream 4.0", credit: 2 },
  "doubao-seedream-4-5-251128": { name: "Seedream 4.5", credit: 3 },
  "doubao-seedream-5-0-260128": { name: "Seedream 5.0 lite", credit: 2 },
  "doubao-seedream-5-0-pro-260628": { name: "Seedream 5.0 pro", credit: 4 },
};

export function loadCredentials(credsPath = path.join(HERE, ".credentials.json")) {
  const creds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
  if (!creds.token) throw new Error(`No "token" in ${credsPath}`);
  return creds;
}

function authHeaders(creds, extra = {}) {
  return {
    ...HEADERS,
    authorization: `Bearer ${creds.token}`,
    origin: "https://sider.ai",
    referer: "https://sider.ai/zh-TW/create/image",
    ...extra,
  };
}

/** Current plan, quota and the model list the account may actually use. */
export async function loadModels(creds) {
  const res = await request({
    url: `${CREATE_API}/v1/image/load-engines?app_name=ChitChat_Web`,
    headers: authHeaders(creds),
  });
  return res.data?.data?.engines?.filter((e) => !e.deprecated) ?? [];
}

/**
 * Upload a local image and return the server-side file record. The returned
 * `fileId` is what goes into `multi_content` as a reference image.
 */
export async function uploadImage(creds, filePath) {
  const res = await request({
    url: `${CREATE_API}/v1/files/upload`,
    method: "POST",
    headers: authHeaders(creds),
    fields: { file: { path: path.resolve(filePath) } },
  });
  if (res.status !== 201 || res.data?.code !== 0) {
    throw new Error(`upload failed (${res.status}): ${res.text.slice(0, 300)}`);
  }
  return res.data.data;
}

/**
 * Ask the creator model for an image. Returns the artifacts the `generate_image`
 * tool produced, plus any streamed assistant text.
 *
 * `referenceImages` are local file paths (or already-uploaded fileIds).
 */
export async function generateImage(creds, opts) {
  const {
    prompt,
    model = "gpt-image-2",
    resolution = "1K",
    quality = "low",
    aspectRatio = "1:1",
    referenceImages = [],
    referenceRole = "reference_image",
    onEvent,
    timeoutMs = 300000,
  } = opts;

  const multiContent = [];
  for (const ref of referenceImages) {
    const fileId = typeof ref === "string" && /^[0-9a-f]{16,}$/i.test(ref) ? ref : (await uploadImage(creds, ref)).fileId;
    multiContent.push({ type: "file", file: { type: "image", file_id: fileId, role: referenceRole } });
  }
  multiContent.push({ type: "text", text: prompt });

  const creatorParam = JSON.stringify({
    mode: "image",
    model,
    resolution,
    quality,
    aspect_ratio: aspectRatio,
  });

  const artifacts = [];
  const texts = [];
  let conversation = null;
  let failure = null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await stream({
      url: `${CREATE_API}/v1/llm/completion`,
      // No explicit `accept` header: Cloudflare challenges this path when one is
      // present, and the server still answers with SSE.
      headers: authHeaders(creds),
      json: { multi_content: multiContent, creator_param: creatorParam },
      signal: controller.signal,
      onEvent: (ev) => {
        onEvent?.(ev);
        const d = ev.data;
        if (!d || typeof d !== "object") return;
        if (d.type === "conversation") conversation = d;
        else if (d.type === "message" && d.textType === "chat") texts.push(d.text);
        else if (d.type === "tool_result") {
          if (d.status && d.status !== "success") failure = d;
          for (const a of d.imageArtifacts ?? []) artifacts.push(a);
        } else if (d.type === "error" || ev.event === "error") failure = d;
      },
    });
  } finally {
    clearTimeout(timer);
  }

  if (!artifacts.length && failure) {
    const code = failure.code ?? failure.error?.code;
    if (code === 1001 || code === 1002) {
      throw new Error(
        `token 无效或已过期（code ${code}）。请重新登录 sider.ai，在控制台执行\n` +
          `  decodeURIComponent(document.cookie.match(/token=([^;]+)/)[1]).replace(/^Bearer\\s*/, "")\n` +
          `然后把结果写进 ${path.join(HERE, ".credentials.json")} 的 token 字段。`,
      );
    }
    throw new Error(`generation failed: ${JSON.stringify(failure).slice(0, 400)}`);
  }
  return { artifacts, text: texts.join(""), conversation };
}

/**
 * file-cdn links only validate against the CloudFront distribution hostname that
 * the signed cookies were issued for, so swap the host before downloading.
 */
export async function signFileCookies(creds) {
  const res = await request({ url: `${API}/v1/image/sign-cookie`, method: "POST", headers: authHeaders(creds) });
  const data = res.data?.data;
  if (!data?.cookies) throw new Error(`sign-cookie failed (${res.status}): ${res.text.slice(0, 200)}`);
  return {
    host: data.domain,
    header: data.cookies.map((c) => `${c.Name}=${c.Value}`).join("; "),
  };
}

export function rewriteFileUrl(url, cloudfrontHost) {
  return cloudfrontHost ? url.replace(/^https:\/\/[^/]*sider\.ai/, `https://${cloudfrontHost}`) : url;
}

export async function downloadArtifact(signed, artifact, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const url = rewriteFileUrl(artifact.url, signed.host);
  const res = await download({ url, headers: { cookie: signed.header }, outPath });
  if (res.status !== 200) throw new Error(`download ${res.status} for ${url}`);
  return { path: outPath, bytes: res.size };
}

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

/**
 * Read a text file as UTF-8. Excel on Chinese Windows saves CSV as GBK by
 * default, so fall back to that instead of producing mojibake.
 */
function readTextFile(file) {
  const buf = fs.readFileSync(file);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString("utf8");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder("gbk").decode(buf);
    } catch {
      return buf.toString("utf8");
    }
  }
}

/** Minimal RFC4180-ish CSV splitter (handles quoted fields and embedded commas). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * Read a task file. `.jsonl` takes one {prompt, refs?, model?, ...} object per
 * line; `.csv` takes a header row whose columns map to the same fields
 * (`refs` separated by `|`).
 */
export function readTasks(file) {
  const text = readTextFile(file);
  if (file.toLowerCase().endsWith(".csv")) {
    const [header, ...rows] = parseCsv(text);
    const keys = header.map((h) => h.trim());
    return rows.map((row) => {
      const task = {};
      keys.forEach((key, i) => {
        const value = (row[i] ?? "").trim();
        if (!value) return;
        if (key === "refs") task.refs = value.split("|").map((s) => s.trim()).filter(Boolean);
        else if (key === "id") task.id = value;
        else task[key] = value;
      });
      return task;
    });
  }
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"))
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch (e) {
        throw new Error(`bad JSON on line ${i + 1}: ${e.message}`);
      }
    });
}

export async function runBatch({ creds, tasks, outDir, concurrency = 2, defaults = {}, onDone }) {
  const signed = await signFileCookies(creds);
  const results = [];
  let next = 0;

  async function worker(id) {
    while (next < tasks.length) {
      const index = next++;
      const task = { ...defaults, ...tasks[index] };
      const label = task.id || `task-${String(index + 1).padStart(3, "0")}`;
      const params = {
        model: task.model,
        quality: task.quality,
        resolution: task.resolution,
        aspectRatio: task.aspectRatio,
        refs: task.refs ?? task.referenceImages ?? [],
      };
      const started = Date.now();
      try {
        const { artifacts, text } = await generateImage(creds, {
          ...task,
          prompt: task.prompt,
          referenceImages: task.refs ?? task.referenceImages ?? [],
        });
        const files = [];
        for (const [i, artifact] of artifacts.entries()) {
          const target = path.join(outDir, label, `${label}${artifacts.length > 1 ? `-${i + 1}` : ""}.png`);
          files.push((await downloadArtifact(signed, artifact, target)).path);
        }
        const record = {
          index,
          id: label,
          ok: true,
          prompt: task.prompt,
          params,
          images: files,
          text,
          ms: Date.now() - started,
        };
        results.push(record);
        onDone?.(record);
      } catch (err) {
        const record = {
          index,
          id: label,
          ok: false,
          prompt: task.prompt,
          params,
          error: String(err.message ?? err),
          ms: Date.now() - started,
        };
        results.push(record);
        onDone?.(record);
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, tasks.length)) }, (_, i) => worker(i));
  await Promise.all(workers);
  return results.sort((a, b) => a.index - b.index);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[key] = value;
    } else out._.push(a);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  const creds = loadCredentials(args.credentials);

  if (cmd === "models") {
    for (const e of await loadModels(creds)) {
      console.log(`${e.id.padEnd(32)} ${String(e.name).padEnd(22)} credit=${e.credit ?? "-"}`);
    }
    return;
  }

  if (cmd === "upload") {
    const rec = await uploadImage(creds, args._[1]);
    console.log(JSON.stringify(rec, null, 2));
    return;
  }

  if (cmd === "gen") {
    const prompt = args._.slice(1).join(" ");
    const outDir = args.out || path.join(HERE, "out");
    const signed = await signFileCookies(creds);
    const { artifacts } = await generateImage(creds, {
      prompt,
      model: args.model,
      resolution: args.resolution,
      quality: args.quality,
      aspectRatio: args.ratio,
      referenceImages: args.ref ? String(args.ref).split(",") : [],
    });
    for (const [i, a] of artifacts.entries()) {
      const target = path.join(outDir, `gen-${Date.now()}${artifacts.length > 1 ? `-${i + 1}` : ""}.png`);
      await downloadArtifact(signed, a, target);
      console.log("saved", target, `${a.width}x${a.height}`);
    }
    return;
  }

  if (cmd === "batch") {
    const file = args._[1];
    const tasks = readTasks(file);
    // Reference images are written relative to the kit folder, but people run
    // this from all sorts of places, so try the likely bases in turn.
    const taskDir = path.dirname(path.resolve(file));
    const refBases = [process.cwd(), taskDir, path.dirname(taskDir)];
    for (const task of tasks) {
      const refs = task.refs ?? task.referenceImages;
      if (!Array.isArray(refs)) continue;
      const resolved = refs.map((ref) => {
        if (typeof ref !== "string" || path.isAbsolute(ref) || /^[0-9a-f]{16,}$/i.test(ref)) return ref;
        for (const base of refBases) {
          const candidate = path.resolve(base, ref);
          if (fs.existsSync(candidate)) return candidate;
        }
        return ref;
      });
      if (task.refs) task.refs = resolved;
      else task.referenceImages = resolved;
    }
    const outDir = args.out || path.join(HERE, "out");
    const defaults = {
      model: args.model || "gpt-image-2",
      resolution: args.resolution || "1K",
      quality: args.quality || "low",
      aspectRatio: args.ratio || "1:1",
    };
    console.log(`batch: ${tasks.length} task(s), model=${defaults.model}, out=${outDir}`);
    // Record each task as it finishes so a crash or a Ctrl-C keeps the results
    // of everything generated so far.
    fs.mkdirSync(outDir, { recursive: true });
    const resultsPath = path.join(outDir, "results.jsonl");
    fs.writeFileSync(resultsPath, "");
    const results = await runBatch({
      creds,
      tasks,
      outDir,
      concurrency: Number(args.concurrency || 2),
      defaults,
      onDone: (r) => {
        fs.appendFileSync(resultsPath, JSON.stringify(r) + "\n");
        console.log(r.ok ? `  ok   ${r.id} (${(r.ms / 1000).toFixed(1)}s)` : `  FAIL ${r.id}: ${r.error}`);
      },
    });
    fs.writeFileSync(resultsPath, results.map((r) => JSON.stringify(r)).join("\n") + "\n");
    const failed = results.filter((r) => !r.ok).length;
    console.log(`done: ${results.length - failed}/${results.length} ok`);
    if (failed) process.exitCode = 1;
    return;
  }

  console.log(
    [
      "sider <command>",
      "",
      "  models                              list models available to the account",
      "  upload <file>                       upload an image, print its fileId",
      '  gen "<prompt>" [--ref a.jpg,b.jpg]  generate one image',
      "  batch <tasks.jsonl> [--concurrency 2] [--model ...] [--out dir]",
      "",
      "global: --credentials <path> --model --resolution --quality --ratio",
      `proxy:  ${detectProxy() ?? "none detected"}`,
    ].join("\n"),
  );
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("sider.mjs")) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
