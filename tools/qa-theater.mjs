/**
 * 剧场模式冒烟测试（本地 QA 用，依赖 Codex 运行时自带的 playwright）。
 *
 *   $env:NODE_PATH="...\\codex-primary-runtime\\dependencies\\node\\node_modules"
 *   node tools/qa-theater.mjs http://127.0.0.1:8099 [--book morning-colors] [--legacy sunset-west]
 *
 * 会依次打开四节剧场，检查：场景标题、背景图是否按场景切换、配乐是否切换、
 * 控制台有没有报错，并把截图写到 .qa/ 目录。
 */
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i];
  else positional.push(argv[i]);
}
const base = (positional[0] || "http://127.0.0.1:8099").replace(/\/$/, "");
const book = String(flags.book || "morning-colors");
const legacyBook = String(flags.legacy || "sunset-west");
const outDir = ".qa";
fs.mkdirSync(outDir, { recursive: true });

const chapters = [1, 2, 3, 4];
// 运行时自带的 playwright 没有下载浏览器，用系统已装好的 Chrome / Edge。
let browser = null;
for (const channel of ["chrome", "msedge", undefined]) {
  try {
    browser = await chromium.launch(channel ? { channel } : {});
    console.log("browser:", channel || "bundled chromium");
    break;
  } catch (e) {
    /* 试下一个 */
  }
}
if (!browser) {
  console.error("没有可用的浏览器，跳过 QA");
  process.exit(0);
}
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});

for (const c of chapters) {
  const url = `${base}/read.html?id=${encodeURIComponent(book)}&c=${c}&mode=theater`;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForSelector(".theater.open", { timeout: 15000 });
  await page.waitForTimeout(2500);

  const seen = [];
  const total = await page.evaluate(() => window.QJ_READY.chapter.paragraphs.length);
  let midShot = false;
  // 逐句推进，记录每次换场景时的标题与背景图
  for (let i = 0; i < 400; i++) {
    const info = await page.evaluate(() => {
      const cap = document.querySelector("[data-t-scene]");
      const bg = document.querySelector(".theater-bg.is-active");
      const count = document.querySelector("[data-t-count]");
      const mood = window.QJMusic ? window.QJMusic.currentMood() : null;
      return {
        scene: cap ? cap.textContent.trim() : "",
        bg: bg ? bg.style.backgroundImage : "",
        count: count ? count.textContent : "完结",
        mood
      };
    });
    if (!seen.length || seen[seen.length - 1].scene !== info.scene) seen.push(info);
    if (info.count === "完结") break;
    if (!midShot) {
      const [cur, tot] = String(info.count).split("/").map((s) => parseInt(s, 10));
      if (tot && cur / tot > 0.42) {
        midShot = true;
        await page.screenshot({ path: `${outDir}/theater-c${c}-mid.png` });
      }
    }
    await page.click(".theater-stage", { position: { x: 800, y: 200 } });
    await page.waitForTimeout(90);
    const done = await page.evaluate(() => {
      const el = document.querySelector("[data-t-count]");
      return !el || el.textContent === "完结";
    });
    if (done) break;
  }

  await page.screenshot({ path: `${outDir}/theater-c${c}.png` });
  console.log(`\n=== 第 ${c} 节（${total} 段）换场记录 ${seen.length} 次 ===`);
  seen.forEach((s) => console.log(`  [${s.count}] ${s.scene}  <- ${s.bg.slice(5, -2)}  (mood=${s.mood})`));
}

// 老格式（逐段数组）的书也要能正常演：用《日薄西山》第一节做回归
await page.goto(`${base}/read.html?id=${encodeURIComponent(legacyBook)}&c=1&mode=theater`, { waitUntil: "load" });
await page.waitForSelector(".theater.open", { timeout: 15000 });
await page.waitForTimeout(2000);
await page.click(".theater-stage", { position: { x: 800, y: 200 } });
await page.waitForTimeout(400);
const legacy = await page.evaluate(() => ({
  bg: document.querySelector(".theater-bg.is-active").style.backgroundImage,
  text: document.querySelector("[data-t-text]").textContent.slice(0, 18),
  count: document.querySelector("[data-t-count]").textContent
}));
console.log(`\n=== 老格式回归（${legacyBook} / 第一节）===`);
console.log(" ", legacy.count, legacy.bg.slice(5, -2), "|", legacy.text);

console.log("\n错误：", errors.length ? errors : "无");
await browser.close();
