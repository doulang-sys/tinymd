# tinymd

极致轻量的 Markdown 浏览器。基于 [Tauri 2](https://tauri.app) 的跨平台桌面应用，安装包目标 < 10MB。

## 特性（v0.1 计划）

- 打开本地目录，侧边文件树浏览 `.md` 文件
- 拖入单个 `.md` 文件直接阅读
- 代码高亮、KaTeX 公式、表格、任务列表
- 大纲导航、亮/暗主题、常用快捷键
- Windows / macOS / Linux

## 开发

前置依赖：Node.js 20+、Rust stable（Windows 需 WebView2，Win10/11 自带）。

```bash
npm install
npm run tauri dev
```

构建发布：

```bash
npm run tauri build
```

产物位于 `src-tauri/target/release/bundle/`。

## License

[MIT](./LICENSE)
