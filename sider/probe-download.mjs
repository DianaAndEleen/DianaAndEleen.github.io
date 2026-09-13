// Verify that the CloudFront cookies from /v1/image/sign-cookie unlock file-cdn downloads.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { HEADERS, request } from "./transport.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const creds = JSON.parse(fs.readFileSync(path.join(here, ".credentials.json"), "utf8"));

const auth = {
  ...HEADERS,
  authorization: `Bearer ${creds.token}`,
  origin: "https://sider.ai",
};

const signed = await request({
  url: "https://sider.ai/api/v1/image/sign-cookie",
  method: "POST",
  headers: auth,
});
console.log("sign-cookie ->", signed.status, JSON.stringify(signed.data).slice(0, 300));

const cookies = (signed.data?.data?.cookies ?? []).map((c) => `${c.Name}=${c.Value}`).join("; ");
const url =
  process.argv[2] ||
  "https://file-cdn.sider.ai/u/U06XHO2W9K8/file/59e07686-033d-45ab-ba18-ffb69b86bcc8/1a08fe099f758.png";

const res = await request({ url, headers: { cookie: cookies } });
console.log("download ->", res.status, "bytes:", res.text.length, res.text.slice(0, 80).replace(/\s+/g, " "));
