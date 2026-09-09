# 青简 · 同人书苑

一个纯静态的原创/同人小说阅读站，使用 HTML + CSS + 原生 JavaScript 构建，
部署在 GitHub Pages。没有构建步骤，也不需要后端。

## 亮点：沉浸剧场（Galgame 式阅读）

每部小说的每一章都可以切换成剧场模式：

- 把每一段文字拆成若干句，逐句显示在画面底部的对白框中；
- 每一段文字配一张背景图，场景之间交叉淡入，并带有缓慢的镜头推近；
- 背景音乐支持真实音频，并以浏览器实时合成作为加载失败时的兜底（雾海 / 雨夜 / 星海 / 春山 / 巷口 / 清晨 / 镜城 / 市井 / 潮汐）；
- 支持点击、空格、方向键推进，`A` 自动播放，`M` 开关音乐，`Esc` 退出；
- 章节末尾会出现「本章完」卡片，可直接进入下一章剧场。

入口：

- 阅读页右下角的「沉浸剧场」按钮；
- 阅读页右上角工具栏的「剧场」按钮；
- 书籍详情页的「沉浸剧场」按钮；
- 直接访问 `read.html?id=<书id>&c=<章节号>&mode=theater`。

## 作者中心（本地账号原型）

站点新增了一套可以直接体验的写作流程：

- `login.html`：注册、登录与体验账号；
- `dashboard.html`：个人主页、作者资料、作品与草稿管理；
- `editor.html`：创建作品、编辑章节、选择封面、保存草稿与发布；
- 发布后的作品会自动合并进现有书库、详情页和阅读页。

当前版本为了保持 GitHub Pages 的纯静态部署，账号、会话和作品数据保存在
浏览器 `localStorage` 中，只适合本地体验和产品形态验证，不等同于生产级
账号系统。需要跨设备同步、真实密码安全与多人协作时，建议下一步接入
Supabase、Firebase 或自建 API；页面层已经按可替换的数据层组织。

## 目录结构

```
index.html              首页
library.html            书库
book.html               书籍详情
read.html               阅读页（含剧场模式）
login.html              登录 / 注册
dashboard.html          个人主页与作品管理
editor.html             作品与章节编辑器
data/books.json         小说正文数据
data/scenes.json        剧场模式配置（背景 / 配乐 / 角色名）
assets/css/style.css    站点样式
assets/css/theater.css  剧场模式样式
assets/css/account.css  作者中心样式
assets/js/music.js      Web Audio 实时配乐
assets/js/theater.js    剧场模式引擎
assets/js/store.js      本地账号、作品与草稿数据层
assets/images/scenes/   剧场模式背景图
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

- `mood`：配乐氛围，可选 `sea` / `rain` / `space` / `folk` / `city` / `morning` / `mirror` / `urban` / `tide`；
- `cast`：角色名数组；没有配置 `speakers` 时，`cast[0]` 会用于引号开头的台词，其余显示为「旁白」；
- `backgrounds`：背景池，章节没有单独配置时按段落循环使用；
- `chapters`：按章节号（从 1 开始）逐段指定背景图，优先于 `backgrounds`；
- `speakers`：可选。按章节号和段落序号覆盖说话人，适合双人对话；值设为 `null` 可把该段标为旁白；
- 背景图文件名不含 `.jpg`，统一放在 `assets/images/scenes/`。

### 换成真实音频（可选）

默认配乐是实时合成的，不需要任何音频文件。若要使用自己的音乐：

1. 把音频放到 `assets/audio/`；
2. 在该小说的配置里加一行 `"bgm": "assets/audio/your-track.mp3"`；
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
