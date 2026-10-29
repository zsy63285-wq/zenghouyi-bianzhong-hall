# 曾侯乙编钟数字展厅

览庄 Layor-Brand 出品的编钟交互展页。单文件内联版，插电即用。

## 打开方式

**本地**：直接双击根目录 `index.html`（`file://` 也能跑，不需要服务器）。
想用本地服务器的话：

```bash
python -m http.server 8212
# 浏览器打开 http://localhost:8212
```

**在线（GitHub Pages）**：进 Settings → Pages → Build and deployment，Source 选
`Deploy from a branch`，分支 `main`，目录 `/ (root)`，Save。
等 1–3 分钟，访问：

<https://zsy63285-wq.github.io/zenghouyi-bianzhong-hall/>

> index.html 53MB，Pages 首次拉取会慢几秒，属正常。

## 目录

| 路径 | 说明 |
| --- | --- |
| `index.html` | 主展页（53MB，图片/字体全部内联） |
| `sound/` | 「听见编钟」子页，由主页 iframe 嵌入，含钟架 SVG、音色采样、CSS |
| `models/` | **未同步**。三个 GLB 转出的 JS（约 55MB），index.html 实际引用的是 `models/*.glb`，该目录下是失效冗余，已 `.gitignore` 排除 |

## 更新

```bash
git add -A
git commit -m "update"
git push origin main
```

Pages 会在推送后自动重新发布。
