# Folder analysis — Understand the overall division of work

## Purpose and main functions

Explain folder responsibilities, file collaboration, and subfolders so readers can move from the overview to individual files.

## Scope

Use when creating or updating a selected folder's function graph. Retain the agreed folder, file scope, and treatment of existing results.

## Explain what the folder helps people do

Read folder documentation and main entry points, then selected files as needed. Answer in one to three sentences:

- What data or objects does this folder process?
- What work does it complete, and who uses it?
- When would a user need it?

Example: “This folder brings runtime records from different sources together so users can review results by time and locate the original records.” Identify conclusions based on source reading as interpretations. Describe the user's goal and actual program behavior separately.

## Explain why each file exists

Read every included file in full and describe its actual role and usage. Reuse existing descriptions that are accurate and complete. When a description is missing, add the interpretation to graph data. Changes to descriptions in the target source follow the relevant modification authorization.

Keep real filenames and add a short purpose statement, for example:

- `reader.py`: Read original records.
- `select.py`: Select records that meet the current criteria.
- `report.py`: Organize selected results into a readable report.

For a large file, first identify the main capability it supplies to other files; leave internal steps to its detail graph.

## Find how files work together

Follow actual entry points, data transfers, and result storage to establish file collaboration. Each connection should explain “who passes what to whom, and for what purpose.”

Examples: “Read records → provide input for selection” and “Selected results → provide input for report preparation.” Include conditions where useful: “When saving is selected → write the current results.” Imports and calls help locate evidence; actual use determines the connections.

Focus on behavior that affects understanding: files used only for specific choices, work that changes existing records, and failures that preserve previous results. Explain the actual conditions and outcomes and save source locations.

Present independently useful files as independent items. Describe external programs through confirmed inputs and outputs, marking remaining questions for confirmation.

## Organize the overview and files together

Use a few main functions at the upper level and actual files at the lower level to explain who performs the work. Expanding a function reveals participating files and their connections. Keep each file once, record all its actual connections when it serves several functions, and choose a primary display position.

Connections between upper-level functions require evidence of actual file collaboration. Preserve important relationships in the data, using short, understandable descriptions on the graph.

For a large folder that the user wants to explore gradually, show direct subfolders and files first. Explain each subfolder's purpose, retain source evidence, and link it to its own graph. The page indicates when a subfolder graph remains to be generated.

## Connect the path into file internals

Folder graphs explain collaboration between files; file graphs explain how each file performs its work. Keep explanations consistent and connect each filename to the graph of the same source file.

Newly generated scopes include file detail graphs by default. Follow the user's choice when they want only an overview or prefer existing file graphs. When an existing explanation conflicts with current source, briefly explain the concrete change and update according to the user's decision.

## Introduce the result

Lead with the folder's main capability, then explain expansion and file details. Example:

> This graph shows how records are read, selected, and organized into a report. Click a function to see participating files, then click a filename to explore its internal work.

Keep storage locations, program fields, and layout calculations in internal production notes. Explain them when they help the user decide or when the user asks.
