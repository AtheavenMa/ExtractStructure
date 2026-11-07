[English](README.md) | [中文](README.zh-CN.md)

# ExtractStructure

An Agent Skill that turns documents and code repositories into interactive structure maps.

## What it does

- **Documents:** Analyze Markdown, LaTeX, and PDF files to map key ideas, methods, evidence, and their relationships.
- **Code repositories:** Explain Python project structure, file responsibilities, and how components work together.
- **Interactive viewer:** Explore results by expanding nodes, navigating files, searching, and switching between English and Chinese.

## Install

```bash
npx skills add AtheavenMa/ExtractStructure
```

## Use

Ask your AI agent:

```text
Use extract-structure to visualize this paper: path/to/paper.pdf
Use extract-structure to map this project: path/to/repository/
```

The agent analyzes the selected files and serves the resulting map in a local browser viewer.

## Requirements

Python 3.9+ and a browser. The included graph tools use Python's standard library; PDF reading depends on the host agent's available tools.

## License

© 2026 Haotian Ma. All rights reserved.

This project is publicly available for reference and academic citation. See [LICENSE](LICENSE) for details.
