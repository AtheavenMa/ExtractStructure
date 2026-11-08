[English](README.md) | [中文](README.zh-CN.md)

# ExtractStructure

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.24051078.svg)](https://doi.org/10.5281/zenodo.24051078)

![Interactive structure map of Attention Is All You Need](assets/screenshots/attention-paper-structure.png)

An Agent Skill that turns documents and code repositories into interactive structure maps.

## What it does

- **Documents:** Analyze Markdown, LaTeX, and PDF files to map key ideas, methods, evidence, and their relationships.
- **Code repositories:** Explain Python project structure, file responsibilities, and how components work together.
- **Interactive viewer:** Explore results by expanding nodes, navigating files, searching, and switching between English and Chinese.

## Examples

- [GPT code structure map](https://atheavenma.github.io/ExtractStructure/examples/gpt-code-structure.html): Explore the structure of GPT model code.
- [Attention Is All You Need paper structure map](https://atheavenma.github.io/ExtractStructure/examples/attention-is-all-you-need-paper-structure.html): Explore the paper's main ideas and their relationships.

Click either link to open the interactive page directly in your browser. Each example is also available as a self-contained HTML file in [`examples/`](examples/) for offline use.

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

The agent reads your selected files and creates an interactive map. Open it in a local browser viewer or save it as a self-contained HTML page to share.

## Requirements

Python 3.10+ and a browser. The included graph tools use Python's standard library; PDF reading depends on the host agent's available tools.

## License

Copyright (c) 2026 Haotian Ma.

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Citation

If you use ExtractStructure in your work, please cite the Zenodo release:

```bibtex
@software{ma2026extractstructure,
  author    = {Ma, Haotian},
  title     = {ExtractStructure: An Agent Skill for Interactive Structure Visualization},
  year      = {2026},
  version   = {0.1.0},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.24051078},
  url       = {https://doi.org/10.5281/zenodo.24051078}
}
```
