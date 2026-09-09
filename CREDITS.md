# 素材来源与许可

## 剧场模式背景图

剧场模式使用的背景图全部下载自 [Unsplash](https://unsplash.com/)，遵循
[Unsplash License](https://unsplash.com/license)：可免费用于个人与商业项目，
无需事先授权（署名不是强制要求，这里主动列出以表示感谢）。

所有图片均已本地化到 `assets/images/scenes/`，站点运行时不依赖外部图床。
下载时统一裁切为 1600×900、JPEG 压缩，便于网页加载。

| 文件 | Unsplash 图片 ID | 原页面 |
| --- | --- | --- |
| `sea-fog-coast.jpg` | `LfgOlvXhZvs` | https://unsplash.com/photos/LfgOlvXhZvs |
| `sea-pier.jpg` | `oZVXx64Fn30` | https://unsplash.com/photos/oZVXx64Fn30 |
| `forest-mist.jpg` | `0xZRmiWUNao` | https://unsplash.com/photos/0xZRmiWUNao |
| `mountain-village.jpg` | `DsJTg3Q-WDg` | https://unsplash.com/photos/DsJTg3Q-WDg |
| `garden-greens.jpg` | `MS9vUvGn5Yo` | https://unsplash.com/photos/MS9vUvGn5Yo |
| `ocean-sunset.jpg` | `NP7Hdo8ModE` | https://unsplash.com/photos/NP7Hdo8ModE |
| `lighthouse-sea.jpg` | `x4eZXkz8-ng` | https://unsplash.com/photos/x4eZXkz8-ng |
| `rain-window.jpg` | `aYbzxyD6Ipg` | https://unsplash.com/photos/aYbzxyD6Ipg |
| `night-bokeh.jpg` | `pbfBx0xLD5M` | https://unsplash.com/photos/pbfBx0xLD5M |
| `bookstore-cozy.jpg` | `hQ1vGSiMJLI` | https://unsplash.com/photos/hQ1vGSiMJLI |
| `bookstore-shelves.jpg` | `mKUKR9lxoPE` | https://unsplash.com/photos/mKUKR9lxoPE |
| `city-rain-night.jpg` | `dT1sPOkA72I` | https://unsplash.com/photos/dT1sPOkA72I |
| `coffee-table.jpg` | `1UfeImpRUh0` | https://unsplash.com/photos/1UfeImpRUh0 |
| `milkyway-lake.jpg` | `a4AlHQITueU` | https://unsplash.com/photos/a4AlHQITueU |
| `starry-sky.jpg` | `SYF7UjbDQB4` | https://unsplash.com/photos/SYF7UjbDQB4 |
| `clocktower.jpg` | `y9ql8en7giU` | https://unsplash.com/photos/y9ql8en7giU |
| `tower-cloudy.jpg` | `BlKSwPC-H18` | https://unsplash.com/photos/BlKSwPC-H18 |
| `antique-mirror.jpg` | `3LD_py-5auE` | https://unsplash.com/photos/3LD_py-5auE |
| `desk-globe.jpg` | `3ULMRQZ5APA` | https://unsplash.com/photos/3ULMRQZ5APA |

## 剧场模式配乐

剧场模式默认不加载任何外部音频文件，而是由 `assets/js/music.js`
通过 Web Audio API 实时合成环境音乐（长音铺底、钟琴点缀、空气噪声），
因此不存在版权与授权问题，也不依赖网络。

如果后续要换成真实音频，在 `data/scenes.json` 中给对应小说加上
`"bgm": "assets/audio/xxx.mp3"` 即可（详见 `README.md`）。

## 封面与横幅

`assets/images/covers/`、`assets/images/banners/` 为项目原有素材，
如用于正式发布，请自行确认其来源与授权。
