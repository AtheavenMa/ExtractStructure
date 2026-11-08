# Graph data and storage

## Purpose and main functions

Describe internal draft fields, source locations, bilingual content, commands, and result storage.

## Scope

Use this skill's programs to create, save, link, or open graph data. This document guides internal program operation; explanations to users follow the folder and file analysis guidance.

## Internal files and runtime requirements

Executable files reside in this skill's `scripts/`, drawing resources in `assets/viewer/`, and results in `results/`. Programs use the Python 3.10+ standard library; browsers load local JavaScript and CSS. Programs locate internal files relative to the skill and analyze an explicitly selected project folder.

Replace `<skill-directory>` with the absolute folder containing `SKILL.md`, and `<project-root>` with the target project's absolute path. Relative target paths and `--include`/`--exclude` are relative to the project root. Draft file paths are relative to the command's working directory. Keep drafts, text extraction and other working files inside this skill's `results/tasks/<task-id>/`; log them as described in the skill entrypoint.

Graph `source`, source references, and page paths include the project root's name. For `/work/demo/package/read.py`, the graph source identity is `demo/package/read.py`. Graphs use a separate project result directory, with the absolute root path distinguishing projects with the same name.

Programs read source and add locations; the agent supplies functional meaning and relationships. Saving checks required drawing fields and actual file scope. Tests, browser checks, and full semantic reviews follow explicit user requests.

## Select scope before finding existing graphs

Use file listings for initial folder recommendations and for assessing scopes above 100 files. Once scope is clear, use these commands to read file headers, source locations, and existing graphs:

```bash
python <skill-directory>/scripts/extract_structure.py --root <project-root> inventory package
python <skill-directory>/scripts/extract_structure.py --root <project-root> discover package
```

Subfolders are included recursively by default. `--direct` selects direct Python files only. Repeatable `--include` and `--exclude` take explicit project-relative paths, such as including `package/read.py` and `package/report.py`, or skipping `package/history`. Select concrete file or directory paths. Keep the same agreed scope for inventory, creation, and linking.

`inventory` reports purpose, scope, source digest, and locatable names for each included file. Folder analysis automatically omits `__init__.py`. Keep other empty files as real files, using `<module>` for their overall role. Python parsing failures report paths and reasons; explain their actual impact and determine the next scope accordingly.

`discover` reports whether folder, direct subfolder, and file graphs exist and are usable. Use `cached_file_count` and `file_count` for the X/Y shown to users. File graph `source_sha_matches` compares the recorded source digest. Folder graph `recorded_files_match` compares recorded files; also compare the current listing for additions and removals. Derived direct-subfolder views are readable on the page, while inventory `exists` reports whether a separate folder graph was saved.

`discover` also accepts a single file and reports its existing graph. Follow `SKILL.md` when offering reuse or redrawing.

## Folder graph drafts

Drafts contain:

- `purpose`: Overall folder purpose.
- `context`: Optional background and external dependencies.
- `files`: Keys are paths relative to the selected folder. Each entry supplies `name` and `category`; explicitly providing `meaning` is recommended. Add `purpose` and `scope` to graph data when missing from file headers.
- `groups`: Entries contain `id`, `name`, `meaning`, `category`, and `files`. Each file appears once in a group's `files`; participation in other functions uses those groups' `shared_files`.
- `edges`: Actual file connections with `from`, `to`, `label`, `description`, and `source`.
- `upper_edges`: Connections between functions using group IDs and the same descriptive fields. The program finds corresponding lower-level paths.
- `shared_targets`, `shared_sources`: Optional mappings from relative file paths to short explanations of shared incoming or outgoing work.
- `i18n`: English and Chinese content, described below.

A folder edge's `source` is a list of entries containing `file` and optional `symbol`. `file` is relative to the selected folder; `symbol` is a real class, function, or nested name, with `<module>` for the whole file. Edge endpoints, group members, and draft `files` use the same relative paths.

The following is a synthetic structural example. Replace its files, explanations, connections, and bilingual data with actual reading evidence:

```json
{
  "purpose": "Prepare a readable report from selected records",
  "files": {
    "read.py": {"category": "input", "name": "Read source records", "meaning": "Provide the source records needed for this report."},
    "report.py": {"category": "output", "name": "Prepare the report", "meaning": "Organize the received records into a readable report."}
  },
  "groups": [
    {"id": "INPUT", "category": "input", "name": "Prepare records", "meaning": "Provide records for the report.", "files": ["read.py"]},
    {"id": "REPORT", "category": "output", "name": "Present results", "meaning": "Make the records readable.", "files": ["report.py"]}
  ],
  "edges": [{
    "from": "read.py", "to": "report.py",
    "label": "Provide records for the report",
    "description": "The reader provides records used to prepare the report.",
    "source": [{"file": "report.py", "symbol": "<module>"}]
  }],
  "upper_edges": [{
    "from": "INPUT", "to": "REPORT",
    "label": "Supply records for presentation",
    "description": "Prepared records are used to present the results.",
    "source": [{"file": "report.py", "symbol": "<module>"}]
  }]
}
```

For direct-subfolder mode, add `folders` keyed by direct subfolder name, with `name`, `meaning`, `purpose`, `scope`, and `source`. Example: `source: [{"file": "reader/load.py", "symbol": "load"}]`. Here `files` covers selected direct Python files and `folders` selected visible direct subfolders. Groups and edges can use file or subfolder names. Read outside-scope material for necessary evidence; graph nodes represent selected files and subfolders.

Each group has at least one primary member. `columns` is a positive integer; `representative` names its primary member. The program computes the default compact layout. To preserve authored coordinates when needed, supply `layout_shape: "authored"` and group `origin: [x,y]`. Explain real return paths with `feedback: true` and `reason`.

`stable_positions` stores full L2 reference coordinates. The page arranges currently visible groups compactly. For layout choices, colors, transparent labels, and immediate interaction, read [Presentation and interaction](presentation.md). Purpose and main functions: Describe ExtractStructure's established visual, layout, interaction, and performance requirements, and identify the shared page resources responsible for them. Scope: Use when generating or reusing ExtractStructure graph data, delivering pages, or modifying this skill's drawing and presentation resources.

## Article graph drafts

Use `article` for Markdown, TeX and PDF. It shares `purpose`, `groups`, `edges`, `upper_edges`, categories, bilingual content and layout options with file drafts. Supply `coverage` as a natural description of the user-selected scope. Each concrete node and relationship supplies original evidence through `source`; groups may supply it or inherit member evidence. These entries replace Python `symbols` for articles.

Synthetic example for an original Markdown document whose selected passage occupies lines 1–8:

```json
{
  "purpose": "Explain how measurements support a comparison",
  "coverage": "The selected method and result paragraphs",
  "groups": [{
    "id": "COMPARE", "name": "Compare measurements",
    "meaning": "Use the same measurement procedure for the compared conditions.",
    "category": "process",
    "nodes": [
      {"id": "METHOD", "name": "Measure each condition", "meaning": "Apply the described measurement procedure to each condition.", "category": "input", "source": [{"path": "study/article.md", "lines": [1, 4], "section": "Method"}]},
      {"id": "RESULT", "name": "Compare observed values", "meaning": "Compare the measurements obtained under the stated conditions.", "category": "output", "source": [{"path": "study/article.md", "lines": [5, 8], "section": "Results"}]}
    ]
  }],
  "edges": [{"from": "METHOD", "to": "RESULT", "label": "Supply measurements", "source": [{"path": "study/article.md", "lines": [5, 8]}]}],
  "upper_edges": []
}
```

For PDF evidence, use `{"path": "study/article.pdf", "pages": [2, 3], "section": "Method", "label": "Equation 1"}`. TeX uses `lines` in the actual included source file. Ranges are inclusive and begin at one. PDF pages refer to physical positions; printed labels can be retained in `label`. Optional `paragraph` identifies a specific paragraph. Paths include the project directory name and remain within the selected project. The primary source comes from the command target. All evidence files receive recorded fingerprints.

```bash
python <skill-directory>/scripts/extract_structure.py --root <project-root> article article.pdf --recipe <skill-directory>/results/tasks/<task-id>/article.json
python <skill-directory>/scripts/extract_structure.py --root <project-root> discover article.pdf
```

Use the existing-result selection before adding `--regenerate`. Discovery reports `source_sha_matches` for the primary file and `source_files_match` for all recorded article sources. Saving checks required drawing fields, source paths and text line ranges. Reading tools supply actual PDF page counts and evidence; content review follows user-requested checks.

Article graphs use `graph_kind: "article"` and the existing `files/` graph identities, retaining the original `.md`, `.tex` or `.pdf` suffix. Stored source references carry page or line ranges. Existing Python and folder graphs retain their formats.

## File graph drafts

File drafts use `purpose`, `groups`, `edges`, `upper_edges`, and optional `i18n`. Groups contain `id`, `name`, `meaning`, `category`, and `nodes`. Concrete nodes contain `id`, `name`, `meaning`, `category`, and `symbols`, with optional `implementation_details`.

Synthetic structural example:

```json
{
  "purpose": "Keep the records needed for this report",
  "groups": [{
    "id": "SELECT", "category": "output", "name": "Select relevant records",
    "meaning": "Keep records that meet the selected requirements.",
    "nodes": [
      {"id": "READ", "name": "Read the requirements", "meaning": "Obtain the user's selection requirements.", "symbols": ["<module>"], "category": "input"},
      {"id": "KEEP", "name": "Keep matching records", "meaning": "Keep records that meet the requirements.", "symbols": ["<module>"], "category": "output"}
    ]
  }],
  "edges": [{
    "from": "READ", "to": "KEEP",
    "label": "Apply the selection requirements",
    "description": "The selected requirements determine which records are kept.",
    "symbols": ["<module>"]
  }],
  "upper_edges": []
}
```

For Python supplied as a text attachment or another filename extension, use `file <target> --format python`. The command parses the original UTF-8 text as Python and preserves its original source identity and line locations. The model code is read as syntax; its imports and training operations remain unexecuted.

`symbols` contains actual names in the target file. Use qualified names for classes and nested functions and `<module>` for the whole file. The program locates source; replace example relationships with actual evidence.

New graphs use `category: "input" | "process" | "output"`, and `"independent"` for nodes with zero incoming and outgoing connections. Determine and store overview and concrete node categories separately. `role` remains a compatibility field for older layouts; `category` determines display classification. `shared_nodes` lists concrete node IDs defined by other groups to record shared implementations. Define each concrete node once in a group's `nodes`.

File edges use concrete node IDs and contain `from`, `to`, and `label`; explicitly providing `description` and `symbols` is recommended, with optional `condition`. Upper-level edges use group IDs and actual lower-level paths. Repetition or returning to earlier work uses `feedback: true` with actual conditions or reasons. Layout options match folder graphs.

The program prefixes upper- and lower-level IDs with `L1_` and `L2_`; drafts use the values before these prefixes. Final JSON contains `graphs`, `mappings`, `source_index`, and `display`. `graph_kind` is `folder`, `file`, or `article`. Connections use `label`; full explanations use `description`. Keep implementation notes and source evidence.

## Bilingual content

Write new graph purposes, names, explanations, connections, conditions, and shared-work summaries in English, then translate them into natural Chinese. Store the following JSON structure; the example encodes Chinese text using standard JSON Unicode escapes:

```json
{
  "i18n": {
    "source_language": "en",
    "translations": {
      "zh": {
        "Read source records": "\u8bfb\u5165\u539f\u59cb\u8bb0\u5f55",
        "read.py\nRead source records": "read.py\n\u8bfb\u5165\u539f\u59cb\u8bb0\u5f55",
        "Provide records for the report": "\u4e3a\u62a5\u544a\u63d0\u4f9b\u8bb0\u5f55"
      }
    }
  }
}
```

Translation keys are complete English originals and values their Chinese translations. Folder node names combine filename, newline, and draft `name`; cover the full combined name. Keep filenames, source paths, IDs, references, and program identities unchanged. Keep original file headers in evidence. Graph `meaning` explains the role and supplies displayed content in both languages.

Service pages default to English and retain stored choices; an explicit `?lang=zh` selects Chinese. Independent exports use their `--language` choice initially and can read an explicit fragment preference such as `#lang=zh`. Language switching preserves expansion and view; missing translations retain original text and indicate translation status.

## Save, reuse, and open

Read new drafts from standard input or `--recipe <draft-file>`. Saving defaults to final JSON only and returns the graph path, source identity, and project identifier.

```bash
python <skill-directory>/scripts/extract_structure.py --root <project-root> folder package --recipe <folder-draft>
python <skill-directory>/scripts/extract_structure.py --root <project-root> file package/read.py --recipe <file-draft>
```

Existing graphs are protected from overwriting by default. Add `--regenerate` after the user chooses redrawing. Reusing file graphs retains their files. Reusing a folder graph uses `link` to add existing detail entries and report coverage changes. Explain new files after reading them and receiving the user's update choice.

```bash
python <skill-directory>/scripts/extract_structure.py --root <project-root> link package
```

`link` retains the existing folder graph's recursion, inclusion, and exclusion settings when a new scope is absent. Pages also link subsequently added file graphs from current results while retaining the old folder graph.

Storage layout:

```text
results/<project-name-and-path-digest>/
├── project.json
├── graphs/
│   ├── folders/<project-name>/<subfolder>.json
│   └── files/<project-name>/<subfolder>/<file>.py.json
└── log_updates.jsonl
```

The project root graph is `graphs/folders/<project-name>.json`. File and article graphs retain their source extension; folder and file graphs use separate directories to preserve same-name entries. `project.json` uses `purpose` and `scope` for its role and coverage; other fields record project identity and source locations. Graph data uses the same purpose and scope fields. Each log line records a timezone-aware timestamp, skill-relative path, content, and actual program source.

The page service reads saved results directly using this skill's programs and resources. Existing results remain readable when source files are temporarily unavailable.

```bash
python <skill-directory>/scripts/extract_structure.py serve --project <saved-project-id> --source <selected-source-identity>
```

The service binds locally, selects an available port by default, and prints its actual address on success. `--port` selects a port explicitly. Always supply `--source` for delivery: the selected folder identity for folder tasks, or selected file identity for individual files. Open that graph with all expandable nodes collapsed. Links carry only required presentation preferences such as language; keep automatic focus/expansion parameters such as `focus_path` empty for an overview of the graph itself. Language changes retain expansion chosen by the user in the page.

Choose delivery from actual user access. For an accessible local service, start it with a terminal tool supporting persistent processes and provide the printed address or a supported forwarded address. Its lifetime follows that process. Restarting reads the same saved results.

## Independent HTML export

```bash
python <skill-directory>/scripts/extract_structure.py export --project <saved-project-id> --source <selected-source-identity> --name <delivery-name> --language zh
```

`--source` accepts a saved graph source or ID. `--name` is a new directory name within `results/<project-id>/deliveries/`. The command writes `index.html`, records it in the project log and prints its absolute path. Existing delivery directories retain their files; choose a new name for a new export. `--language` selects the initial language (`en` by default). `--theme dark` or `--theme light` sets the initial theme; the default `--theme system` follows existing preference and system behavior. An explicit export theme takes precedence over stored browser theme, while a theme selected within the page takes precedence over that export default. Explicit page preferences take precedence, followed by the export language; local service pages can reuse stored language preferences.

Export includes the selected graph, its available descendants and ancestor navigation. Navigation-only directories retain their existing role. Details outside this exported set appear without links. Exported pages use the shared viewer and contain all required data, scripts, styles and worker code. Source documents remain at their original locations; the export contains the graph's recorded explanations and evidence locations.

Open the selected graph with expandable nodes collapsed. Language and theme changes work within the page. Independent page navigation and preferences use URL fragments when supported, and page state remains usable when browser storage is unavailable. Background placement uses a Blob worker or page computation when workers are unavailable. The latter can take longer for complex graphs.

The export command creates a file. For cloud delivery, use the host's attachment or static hosting tools to provide a downloadable file or hosted URL. Host publication and service forwarding depend on available platform capabilities. Keep commands, ports and internal paths out of ordinary graph explanations. SVG and static images follow an explicit format request.

## Discovery and relocation

The entire skill folder can move. Programs and resources use relative locations; `results` moves with it. Saved project IDs suffice to view existing results. Reanalyzing relocated source explicitly selects the new project root; a new path produces a new project identifier while retaining old results.

For a custom installation directory, invoke through the full path to this `SKILL.md`. Automatic discovery follows the host's skill installation locations. The host manages registration and installation; skill files and results reside inside the skill folder.
