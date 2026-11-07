[English](README.md) | [中文](README.zh-CN.md)

# ExtractStructure

An Agent Skill that turns documents and code repositories into interactive structure maps.

## What it does

- **Documents:** Analyze Markdown, LaTeX, and PDF files to map key ideas, methods, evidence, and their relationships.
- **Code repositories:** Explain Python project structure, file responsibilities, and how components work together.
- **Interactive viewer:** Explore results by expanding nodes, navigating files, searching, and switching between English and Chinese.

## Examples

- [GPT code structure map](examples/gpt-code-structure.html): Explore the structure of GPT model code.
- [Attention Is All You Need paper structure map](examples/attention-is-all-you-need-paper-structure.html): Explore the paper's main ideas and their relationships.

Each example is a self-contained interactive HTML page. Open the file link, download the raw file from GitHub, and open it in your browser.

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

Copyright (c) 2026 Haotian Ma.

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
