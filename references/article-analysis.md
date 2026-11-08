# Article analysis — Read and preserve original evidence

## Purpose and main functions

Explain how to turn selected Markdown, TeX and PDF passages into article topics, details and relationships with original source locations.

## Scope

Use when creating or updating an article graph after the user selects the text and coverage, including articles whose body spans several files.

## Read and organize

Use the text-scope choices and research reading guidance in the skill entrypoint. Read selected passages before drafting the graph. Organize topics by the article's actual questions, reasoning, methods and evidence. Keep each shared idea as one node and connect it to its actual roles.

Preserve assumptions, core calculations, experimental comparisons and key results in node explanations. Give each topic a short name and a substantive explanation. Choose topics and their order from the article's meaning; the shared viewer arranges their regions.

## Record evidence

Each concrete node and each relationship supplies a nonempty `source` list. Each entry contains:

- `path`: Original file path relative to the selected project root's parent, including the project folder name, as in saved Python graphs.
- `lines: [first, last]`: Inclusive original line numbers for Markdown and TeX.
- `pages: [first, last]`: Inclusive physical PDF page positions, counted from one. Printed page labels may be recorded in `label`.
- Optional `section`, `label` and `paragraph`: Short original identifiers that help locate the passage, equation, figure or table.

The primary file and all evidence files belong to the explicitly selected source directory. Multi-file TeX uses the actual included file for each passage. Group evidence defaults to the union of its members; supply a group `source` when a more precise passage supports its overview. Relationship evidence identifies the passage supporting the connection.

The save command checks file availability, reference shape and text line ranges. PDF page ranges come from the agent's actual reading tools and page inventory. The article graph records every evidence file's fingerprint so later discovery can report source changes.

## Save the article

Use the `article` draft and command in [Graph data and storage](graph-format.md). Purpose and main functions: Describe internal draft fields, source locations, bilingual content, commands, and result storage. Scope: Use this skill's programs to create, save, link, or open graph data. This document guides internal program operation; explanations to users follow the folder and file analysis guidance.

Article graphs use the existing two-level viewer: topics above and concrete article content below. Names identify content; explanations retain its substance. The viewer presents full names and explanations on hover or keyboard focus.
