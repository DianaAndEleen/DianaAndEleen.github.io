// Build a compact digest of every book so cover prompts can be written from content.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data", "books.json"), "utf8"));

const done = new Set(process.argv.slice(2));
const lines = [];

for (const b of data.books) {
  if (done.has(b.id)) continue;
  const text = (b.chapters ?? [])
    .flatMap((c) => c.paragraphs ?? [])
    .join("\n");
  const hasLinJia = /乃琳|嘉然/.test(text);
  const otherCast = [...new Set((text.match(/[\u4e00-\u9fa5]{2,3}(?=说|道|笑|问)/g) ?? []))].slice(0, 12);
  lines.push(
    [
      `## ${b.id} | ${b.title} | ${b.status} | ${b.wordCount}字`,
      `tags: ${(b.tags ?? []).join(" / ")}`,
      `hasLinJia: ${hasLinJia}`,
      `intro: ${b.intro}`,
      `opening: ${text.replace(/\s+/g, " ").slice(0, 150)}`,
      "",
    ].join("\n"),
  );
}

const out = path.join(__dirname, "..", "digest.md");
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log("books:", lines.length, "->", out);
