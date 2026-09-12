# 琳嘉女孩 · 同人馆

一个纯静态的 A-SOUL 嘉然 × 乃琳 同人文阅读站，使用 HTML + CSS + 原生 JavaScript 构建，
部署在 GitHub Pages。没有构建步骤，也不需要后端。

## 亮点：沉浸剧场（Galgame 式阅读）

每部小说的每一章都可以切换成剧场模式：

- 把每一段文字拆成若干句，逐句显示在画面底部的对白框中；
- 每一段文字配一张背景图，场景之间交叉淡入，并带有缓慢的镜头推近；
- 支持按「场景」配图：一段连续情节用同一张图、只在换场时淡入淡出一次，
  左上角会浮出这一场的标题（《清晨的色彩》就是 4 节 / 30 个场景 / 30 张定制插画）；
- 支持按「场景」配乐：换场时自动切换曲目并交叉淡入。曲目可以是
  `assets/js/music.js` 里实时合成的氛围（雾海 / 雨夜 / 星海 / 春山 / 巷口 / 清晨 /
  镜城 / 市井 / 潮汐 / 低电量 / 回忆 / 俏皮 / 心动 / 午后咖啡 / 烟火 / 黄昏 /
  夜色 / 梦境 / 屏息 / 暖光），也可以是自己准备的 mp3；
- 支持点击、空格、方向键推进，`A` 自动播放，`M` 开关音乐，`Esc` 退出；
- 章节末尾会出现「本章完」卡片，可直接进入下一章剧场。

入口：

- 阅读页右下角的「沉浸剧场」按钮；
- 阅读页右上角工具栏的「剧场」按钮；
- 书籍详情页的「沉浸剧场」按钮；
- 直接访问 `read.html?id=<书id>&c=<章节号>&mode=theater`。

## 纯静态阅读站（无需登录）

站点当前是完整的静态阅读站：打开首页即可浏览书库、查看详情并阅读正文，
没有任何登录、注册或权限校验，也不需要后端服务。

- 所有小说内容来自 `data/books.json`，剧场配置来自 `data/scenes.json`；
- 读者侧只读取这些 JSON，不写任何服务端数据；
- 曾经用于演示的「作者中心 / 登录注册」（`login.html`、`dashboard.html`、
  `editor.html`，数据存在浏览器 `localStorage`）已从站点移除，相关代码可在
  Git 历史里找到。

如果之后要恢复在线写作与账号体系（Supabase / Firebase / 自建 API），
建议先并行保留一份静态阅读入口，等接口就绪再把写作台接回导航。

## 目录结构

```
index.html              首页
library.html            书库
book.html               书籍详情
read.html               阅读页（含剧场模式）
data/books.json         小说正文数据
data/scenes.json        剧场模式配置（场景 / 背景 / 配乐 / 角色名）
assets/css/style.css    站点样式
assets/css/theater.css  剧场模式样式
assets/js/music.js      Web Audio 实时配乐（20 种氛围）
assets/js/theater.js    剧场模式引擎
assets/images/scenes/   剧场模式背景图
docs/                   分镜与配乐说明（如《清晨的色彩》的 30 场分镜）
tools/                  出图后处理与小工具
CREDITS.md              素材来源与许可
```

## 给一本新小说配置剧场

正文仍然写在 `data/books.json` 里，剧场只负责“怎么演”。在
`data/scenes.json` 的 `books` 下增加一段配置即可：

```json
{
  "books": {
    "your-book-id": {
      "mood": "sea",
      "cast": ["主角名"],
      "backgrounds": ["sea-fog-coast", "lighthouse-sea", "ocean-sunset"],
      "chapters": {
        "1": ["sea-fog-coast", "lighthouse-sea", "ocean-sunset"],
        "2": ["ocean-sunset", "sea-fog-coast", "lighthouse-sea"]
      },
      "speakers": {
        "1": { "0": "主角名", "1": null }
      }
    }
  }
}
```

- `mood`：整本书的兜底配乐氛围，可选 `sea` / `rain` / `space` / `folk` / `city` /
  `morning` / `mirror` / `urban` / `tide` / `lazy` / `memory` / `playful` / `bloom` /
  `cafe` / `warm` / `dusk` / `night` / `dream` / `tension` / `glow`；
- `cast`：角色名数组；没有配置 `speakers` 时，`cast[0]` 会用于引号开头的台词，其余显示为「旁白」；
- `backgrounds`：背景池，章节没有单独配置时按段落循环使用；
- `chapters`：按章节号（从 1 开始）指定这一章怎么演，优先于 `backgrounds`。
  支持两种写法：
  - **逐段数组**（老写法）：`["a", "b", "c"]`，一段文字一张图；
  - **逐场景对象**（推荐）：把连续段落合并成「场景」，每场一张图、一个标题、
    一段配乐。换场时才切图、切曲、飘出标题：

```json
"chapters": {
  "1": {
    "title": "第一节 · 电梯里的粉色洋娃娃",
    "scenes": [
      { "id": "ch1-01", "img": "morning-colors/ch1-01", "from": 0, "to": 0,
        "name": "不妨出去走走", "mood": "morning",
        "musicStyle": "夏日清晨的通透钢琴，慢速琶音＋极淡弦乐" },
      { "id": "ch1-02", "img": "morning-colors/ch1-02", "from": 1, "to": 2,
        "name": "七点钟的办公室", "mood": "lazy",
        "bgm": "assets/audio/自己的曲子.mp3" }
    ]
  }
}
```

  - `from` / `to`：这个场景覆盖的段落下标（含两端），`to` 省略时等于 `from`；
  - `img`：图片 key，实际文件是 `assets/images/scenes/<img>.jpg`；
  - `name`：场景标题，换场时显示在左上角；
  - `mood`：这一场的合成氛围（见 `assets/js/music.js` 的 `MOODS`）；
  - `bgm`：可选，这一场改用真实音频文件，优先于 `mood`；
  - `musicStyle`：可选，只写给人看的选曲备注（鼠标悬停在左上角曲名上能看到）。

- `speakers`：可选。按章节号和段落序号覆盖说话人，适合双人对话；值设为 `null` 可把该段标为旁白；
- 背景图文件名不含 `.jpg`，统一放在 `assets/images/scenes/`。

### 换成真实音频（可选）

默认配乐是实时合成的，不需要任何音频文件。若要使用自己的音乐：

1. 把音频放到 `assets/audio/`；
2. 在这一本书（或某一个场景）的配置里加一行 `"bgm": "assets/audio/your-track.mp3"`；
3. 建议同时保留 `mood` 作为音频加载失败时的兜底。

请只使用你有权使用的音频，并在 `CREDITS.md` 中注明来源。

## 本地预览

项目使用 `fetch` 读取 `data/*.json`，因此不能用 `file://` 直接打开，
需要起一个本地静态服务器，例如：

```powershell
python -m http.server 8080
```

然后访问 http://localhost:8080/ 。

## 素材许可

剧场背景图来自 Unsplash 与 Pexels；部分作品使用 Creative Commons 授权音频，
其余配乐由浏览器实时合成。完整来源、作者与许可见 [CREDITS.md](CREDITS.md)。
