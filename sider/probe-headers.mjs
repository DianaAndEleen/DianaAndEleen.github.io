// Narrow down which header makes Cloudflare challenge /llm/completion.
// Uses an empty body so the server rejects it immediately without spending credits.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { request } from "./transport.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const creds = JSON.parse(fs.readFileSync(path.join(here, ".credentials.json"), "utf8"));

const base = {
  "x-app-name": "ChitChat_Web",
  "x-app-version": "1.0.0",
  "x-tz-name": "Asia/Shanghai",
  authorization: `Bearer ${creds.token}`,
  origin: "https://sider.ai",
};

const variants = [
  ["bare", {}],
  ["referer", { referer: "https://sider.ai/zh-TW/create/image" }],
  ["accept-sse", { accept: "text/event-stream" }],
  ["accept-json", { accept: "application/json" }],
  ["both", { referer: "https://sider.ai/zh-TW/create/image", accept: "text/event-stream" }],
];

for (const [label, extra] of variants) {
  const res = await request({
    url: "https://sider.ai/api/create/v1/llm/completion",
    method: "POST",
    headers: { ...base, ...extra },
    json: {},
  });
  const cf = /Just a moment|cf_chl_opt/i.test(res.text);
  console.log(`${label.padEnd(12)} status=${res.status} cloudflare=${cf} ${res.text.slice(0, 120).replace(/\s+/g, " ")}`);
}
