[English](README.md) | [中文](README.zh-CN.md)

# ExtractStructure

一个将文档和代码仓库整理成可交互结构图的智能助手技能。

## 主要功能

- **文档：** 分析 Markdown、LaTeX 和 PDF 文件，呈现主要观点、方法、证据及其关系。
- **代码仓库：** 解释 Python 项目的结构、文件职责，以及各部分如何协作。
- **交互页面：** 通过展开节点、切换文件、搜索和中英文切换来探索结果。

## 安装

```bash
npx skills add AtheavenMa/ExtractStructure
```

## 使用

向你的智能助手提出请求：

```text
使用 extract-structure 可视化这篇论文：path/to/paper.pdf
使用 extract-structure 梳理这个项目：path/to/repository/
```

智能助手会分析选定文件，并通过本地浏览器页面展示结构图。

## 运行要求

Python 3.9 及以上版本和浏览器。内置绘图工具使用 Python 标准库；PDF 阅读使用智能助手所在环境提供的工具。

## 许可说明

© 2026 Haotian Ma。保留所有权利。

本项目公开提供参考和学术引用。详情见 [LICENSE](LICENSE)。
