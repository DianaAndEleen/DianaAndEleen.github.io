// Turn the per-book scene descriptions into a batch task CSV.
//
// Shared text lives here so all 50 covers keep the same character description,
// art direction and framing rules.
const fs = require("fs");
const path = require("path");

const JIARAN = "图1是嘉然的角色设定（棕色长发、头顶一根呆毛、脑后大红色蝴蝶结、蓝色眼睛、个子娇小）";
const NAILIN = "图2是乃琳的角色设定（身材高挑、白色长发、蓝色眼睛、气质清冷）";

const STYLE =
  "日系动画风插画，精致唯美，电影感光影，色彩克制有层次，竖版 2:3 构图，画面上方保留大片留白。画面中不要出现任何文字。";

const books = JSON.parse(fs.readFileSync(path.join(__dirname, "covers.json"), "utf8"));

const rows = books.map((b) => {
  let head = "";
  let refs = "";
  if (b.refs === true) {
    head = `${JIARAN}，${NAILIN}。`;
    refs = "refs/嘉然.png|refs/乃琳.png";
  } else if (b.refs === "solo-nailin") {
    head = `${NAILIN}。`;
    refs = "refs/乃琳.png";
  }
  const prompt = `${head}为小说《${b.title}》绘制封面插画：${b.scene}。${STYLE}`;
  return { id: `封面-${b.id}`, prompt, refs };
});

const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const lines = ["id,prompt,refs,model,quality,resolution,aspectRatio"];
for (const r of rows) {
  lines.push([r.id, esc(r.prompt), esc(r.refs), "gpt-image-2", "medium", "2K", "2:3"].join(","));
}

const out = path.join(__dirname, "..", "tasks", "封面-其余书目.csv");
fs.writeFileSync(out, lines.join("\n") + "\n", "utf8");
console.log("书名", rows.length, "->", out);
console.log("有角色参考", rows.filter((r) => r.refs).length, "纯文字", rows.filter((r) => !r.refs).length);
