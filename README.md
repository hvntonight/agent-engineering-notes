# Agent 工程笔记

[阅读教程](https://hvntonight.github.io/agent-engineering-notes/) · [动画课堂](https://hvntonight.github.io/agent-engineering-notes/#animations) · [第一节](https://hvntonight.github.io/agent-engineering-notes/#01) · [参考书架](https://hvntonight.github.io/agent-engineering-notes/#references)

用一张库存单贯穿 Agent 的循环、工具、错误、上下文、验证和评测。8 节正文配合可下载的 Python 小程序、浏览器实验与真实运行记录。

每节增加了一段可播放的动画。沿数据流逐步查看图、讲解、代码示意与输入输出，支持暂停、前后单步、拖动、倍速、全屏与节点职责说明。第 6 段可以切换 Codex、Claude Code、Pi 与 OpenCode V2 的公开架构；还可以改变公式、资料规模和缓存失效策略来观察后果。

动画由本地 SVG 与 JavaScript 绘制，没有视频或字体 CDN 依赖。只有用户开始播放才运行动画；离开页面、滚出视野或切换到后台后暂停，并遵循系统减少动态效果的偏好。网页播放器不调用模型。控制结构是为教学简化的示意，完整文件另行链接；架构图是公开资料抽象，真实轨迹与机制演示保留不同标记。

教程参考了 14 组课程与原始文档的教学组织，包括 Minimal Agent、Hugging Face Agents Course、smolagents、Pydantic AI、Google ADK、LangChain Academy、Berkeley 课程与 Stanford CS329Z。书架逐项说明借鉴、取舍和可访问范围，正文和练习重新编写。

## 目录

1. 先跑通一个循环
2. 给它一把计算器
3. 看一次失败怎样传下去
4. 资料多起来以后
5. 答案没错，任务就完成了吗
6. 带着问题读四个实现
7. 给改动设计一个对照
8. 把它交成一个小项目

第 6 节依据 Codex、Claude Code、Pi 和 OpenCode 的公开资料，分别跟读一条路径；不提供未经实测的四家性能排名。Claude Code 部分使用公开文档与 SDK 边界，Pi/OpenCode 保留固定源码入口与版本说明。

## 在本地运行实验

```bash
cd lab
python3 run.py
python3 run.py --fail-first calculate
python3 run.py --fail-first calculate --steps 3
```

要求 Python 3.12+，默认使用确定性测试策略，模型调用数为 0。真实模型实验与资料变体见 [lab/README.md](lab/README.md)。调用 Codex 时沿用现有登录，不在网站中填写密钥。

网页收录 22 次已保存的真实任务、33 次模型决策。它们是 2026-10-23 的合成开发试验，每条件通常只测一次；固定策略测试、规则演示与这些成绩分开标明。历史实验提供现象和调试线索，不代表公开基准的完整成绩。

## 构建与预览

```bash
python3 build.py
python3 tests/preview.py
```

预览地址为 `http://127.0.0.1:8092/agent-engineering-notes/`。本地故意使用仓库子路径，以检查 GitHub Pages 上的资源路径。生产目录为 `docs/`，所有运行时资源都随站点提供，浏览器无需连接后端。

笔记和已读状态保存在当前浏览器，支持导入 JSON、导出 JSON 和 Markdown。清理浏览器站点数据会删除本机记录，换设备前可先导出。

## 检查

```bash
node --test tests/*.test.js
python3 -m unittest discover -s tests -p 'test_*.py' -v
python3 tests/publication_audit.py
```

浏览器检查需要 Playwright 与 axe-core 的测试依赖，安装在忽略目录 `.qa/` 中：

```bash
npm install --prefix .qa --ignore-scripts playwright @axe-core/playwright
node tests/browser.mjs
node tests/motion-browser.mjs
```

浏览器使用 Playwright 已配置的 Chromium；本机有兼容浏览器时可设置 `CHROMIUM_EXECUTABLE`。`COURSE_BASE_URL` 可指向同一路径下的公网版本。截图和测试临时记录位于忽略目录 `qa-artifacts/`。

核对公网资源哈希、三轮记录，并实际运行下载包的三条确定性路径：

```bash
python3 tests/live_release.py --expected-local
```

该检查不调用模型；`--expected-local` 还会拒绝与当前本地构建不一致的线上版本。

## 发布

GitHub Pages 的发布源为 `main` 分支的 `/docs`。发布使用 PAT 认证的 GitHub REST API 创建或更新 tree、commit 与 branch ref，并配置 Pages；认证由站点之外的本地发布客户端负责。

三轮审阅的发现、修复与验证摘要见 [reviews/index.json](reviews/index.json)，网页也提供[审阅记录](https://hvntonight.github.io/agent-engineering-notes/#reviews)。

动画版另行检查了数据与来源一致性、播放器交互、移动端布局、减少动态效果、生命周期清理和公网构建。浏览器测试临时报告继续保存在忽略目录，不包含用户学习笔记。
