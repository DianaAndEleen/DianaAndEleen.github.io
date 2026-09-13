# Sider 图像生成 API 客户端

> 只想批量出图、不想看协议细节的话，直接用 `D:\Code\DianaAndEleen\sider-batch\`
> 那个自带教程和 bat 的独立文件夹。本目录是原始工作目录，包含逆向记录和验证脚本。

Sider 网页版没有公开的开发者 API，这个目录里的脚本直接复用了网页版自己调用的接口，
所以可以脱离浏览器批量生成图片。

协议是从 `sider.ai/zh-TW/create/image` 页面的前端代码和你抓下来的请求里还原出来的，
下面把两个核心接口写清楚。

## 两个核心接口

所有请求都打到 `https://sider.ai`，鉴权只有一个 `Authorization: Bearer <JWT>` 头，
token 就是浏览器 cookie 里的 `token`（去掉 URL 编码和前缀）：

```
authorization: Bearer eyJhbGciOi...
x-app-name: ChitChat_Web
x-app-version: 1.0.0
x-tz-name: Asia/Shanghai
```

### 1. 上传图片

```
POST https://sider.ai/api/create/v1/files/upload
Content-Type: multipart/form-data   # 字段名固定为 file
```

```json
{"code":0,"data":{"artifactId":"img_...","fileId":"6aa3ce509b47c0a98281cbdf","filename":"a.jpg",
 "url":"https://file-cdn.sider.ai/u/U06XHO2W9K8/file/.../x.png",
 "signedUrl":"https://file-cdn.sider.ai/...&Signature=...&Key-Pair-Id=..."}}
```

后面生成时用的就是 `data.fileId`。相同的文件会被服务端去重，重复上传返回同一个 fileId。

### 2. 生成图片

```
POST https://sider.ai/api/create/v1/llm/completion
Content-Type: application/json
```

```json
{
  "multi_content": [
    {"type": "file", "file": {"type": "image", "file_id": "6aa3ce...", "role": "reference_image"}},
    {"type": "text", "text": "帮我把 Dragon 按图 1 的风格生成，换一个人物主体"}
  ],
  "creator_param": "{\"mode\":\"image\",\"model\":\"gpt-image-2\",\"resolution\":\"2K\",\"quality\":\"medium\",\"aspect_ratio\":\"Auto\"}"
}
```

注意 `creator_param` 是一个 **JSON 字符串**，不是嵌套对象。纯文生图时 `multi_content`
里只放一条 `text` 即可，`role` 用 `reference_image` 表示参考图。

响应是 SSE（`text/event-stream`），一条生成大约 20–90 秒，事件依次是：

| event | 内容 |
| --- | --- |
| `conversation` | conversationId / messageId |
| `tool_calls` | `{"phase":"start"}` |
| `tool_call` | `toolName:"generate_image"` 和它解析出的参数 |
| `ping` | 心跳，每隔几秒一次 |
| `tool_result` | `imageArtifacts[]`，**出图地址在这里** |
| `message` | 助手输出的文字片段 |
| `tool_calls` | `{"phase":"end"}` |

出图信息：

```json
{"type":"tool_result","toolName":"generate_image","status":"success",
 "imageArtifacts":[{"fileId":"6aa3cf00...","url":"https://file-cdn.sider.ai/u/U06XHO2W9K8/file/.../x.png",
                   "width":1024,"height":1024,"size":"741335","prompt":"..."}]}
```

### 3. 下载图片

`file-cdn.sider.ai` 的链接不能直接下载（返回 403），需要 CloudFront 签名 cookie：

```
POST https://sider.ai/api/v1/image/sign-cookie      # 返回 CloudFront-Policy / -Signature / -Key-Pair-Id
```

而且签名策略里的 Resource 写的是 CloudFront 分发域名，所以下载时要把主机名换成
`data.domain`（例如 `d2gpt0zwgfyrvs.cloudfront.net`）再带上这三个 cookie。
签名有效期约 30 天，批量任务里取一次即可复用。

## 三个坑

1. **不要带 `accept` 请求头。** Cloudflare 对 `/llm/completion` 有 Bot 规则，只要请求里出现
   `Accept: text/event-stream`（或任何 accept）就返回 403 人机验证；不带这个头反而正常
   返回 SSE。`sider/probe-headers.mjs` 可以复现这个结论。
2. **不要带 cookie。** 尤其是过期的 `cf_clearance`，带上反而会触发挑战。只发 Authorization。
3. **必须走代理。** 直连 `sider.ai` 不通，脚本会自动读取 Windows 系统代理
   （当前是 `127.0.0.1:7899`），也可以用环境变量 `SIDER_PROXY` 覆盖。

另外，`sider.ai/api/v1/user/login/test_login` 这类邮箱密码登录接口已经下线（404），
所以 token 只能从已登录的浏览器里取，见下方「更新 token」。

## 用法

```bash
node sider/sider.mjs models                       # 列出账号可用的模型和点数
node sider/sider.mjs upload a.jpg                 # 上传，打印 fileId
node sider/sider.mjs gen "一只猫" --model gpt-image-2 --quality low
node sider/sider.mjs gen "重绘成水彩" --ref a.jpg,b.jpg --ratio Auto
node sider/sider.mjs batch sider/tasks.jsonl --concurrency 2 --out sider/out
node sider/sider.mjs batch sider/tasks.csv   --concurrency 2 --model gpt-image-2
```

批量任务文件支持 `.jsonl`（一行一个任务）和 `.csv`（首行表头）。可用字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 任务名，决定输出目录 `out/<id>/<id>.png`；缺省为 `task-001` |
| `prompt` | 提示词（必填） |
| `refs` | 参考图路径，多个用 `|` 分隔（CSV）或数组（JSONL） |
| `model` | 模型 id，见 `models` |
| `quality` | `low` / `medium` / `high`（部分模型还有 `xhigh`/`max`） |
| `resolution` | `1K` / `2K` / `4K` |
| `aspectRatio` | `1:1` `3:4` `4:3` `16:9` `9:16` … 或 `Auto` |

命令行上的 `--model/--quality/--resolution/--ratio` 作为默认值，任务里的同名字段会覆盖它。
结果写到 `out/results.jsonl`，失败的任务只记录错误、不影响其他任务。

## 模型和点数

点数是每次生成的扣费（`gpt-image-2` 按质量分档）：

| model | 名称 | 点数 |
| --- | --- | --- |
| `gpt-image-2` | GPT Image 2 | low 2 / medium 5 / high 20 |
| `gpt-image-2.5-sunburst` / `-flare` | GPT Image 2.5 | 见账号配额 |
| `gemini-2.5-flash-image` | Nano Banana | 5 |
| `gemini-3.1-flash-lite-image` | Nano Banana 2 Lite | 4 |
| `gemini-3.1-flash-image-preview` | Nano Banana 2 | 8 |
| `gemini-3-pro-image-preview` | Nano Banana Pro | 15 |
| `doubao-seedream-4-0-250828` | Seedream 4.0 | 2 |
| `doubao-seedream-4-5-251128` | Seedream 4.5 | 3 |
| `doubao-seedream-5-0-260128` | Seedream 5.0 lite | 2 |
| `doubao-seedream-5-0-pro-260628` | Seedream 5.0 pro | 4 |

## 更新 token

token 存在 `sider/.credentials.json`（已加进 `.gitignore`），当前这个有效期到
**2027-05-03**。过期后重新取一次：在浏览器登录 sider.ai，按 F12 打开控制台执行

```js
decodeURIComponent(document.cookie.match(/token=([^;]+)/)[1]).replace(/^Bearer\s*/, "")
```

把输出粘进 `.credentials.json` 的 `token` 字段即可。

## 目录

```
sider.mjs               客户端 + CLI（upload / gen / batch / models）
transport.mjs           curl 封装：代理自动探测、SSE 解析、二进制下载
.credentials.json       token（gitignore）
tasks.example.jsonl     批量任务示例
tasks.example.csv       批量任务 CSV 示例
probe-headers.mjs       复现 Cloudflare 的 accept 头问题
probe-download.mjs      验证签名 cookie 下载
out/, out-batch/        生成的图片
```
