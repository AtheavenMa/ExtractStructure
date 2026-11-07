---
name: extract-structure
description: ExtractStructure has two modes: read Markdown, TeX, or PDF in depth and visualize an article's overall structure, or summarize an engineering project's structure and explore its files and subfolders. On loading, introduce both modes, recommend visible files or folders, and agree on the analysis scope. Instructions, drawing programs, and results reside inside this skill.
---

# ExtractStructure — Understand articles and engineering projects

## Purpose and main functions

ExtractStructure uses expandable graphs to help people understand the overall structure of articles and engineering projects in two modes:

1. **Text mode.** Work with Markdown (`.md`), TeX (`.tex`), or PDF (`.pdf`), such as a research article. Read and understand the text in depth, then extract and visualize its overall structure so users can move from an overview to specific topics. Organize papers by actual connections between research questions, claims, methods, derivations, and experimental evidence.
2. **Code repository mode.** Produce a structured summary of an engineering project, explain folder responsibilities and file collaboration, and let users select individual files or subfolders for further visualization.

## Scope

Use when the user asks to load or use ExtractStructure, understand Markdown, TeX, or PDF text, summarize a code repository, or explore files and subfolders within a project. Text mode analyzes selected articles or sections. Repository mode analyzes selected folders and files, treating Python (`.py`) and Markdown (`.md`, case-insensitive) as equal file nodes by default. Folder analysis consistently omits `__init__.py`.

The full product name is **ExtractStructure**; the folder and invocation name is `extract-structure`.

This skill contains its instructions, graph assembly programs, drawing resources, and results. The agent reads selected code or text, writes structural explanations, and uses the skill's components to save and display graphs. Python programs use the standard library and pages open in a browser. PDF reading uses text extraction and page viewing tools available in the current environment.

## Startup and conversation

When the user says “load” or “use” ExtractStructure, first deliver the complete fixed introduction from Phase 1, then recommend entry points from visible files and folders. When the user has already specified text, a folder, or scope, follow that choice. Requests to read or discuss the skill, or to pause execution, follow the requested scope.

Keep questions and progress updates focused on meaning, suggestions, and current user choices. Explain what a folder turns into what result and what that helps people accomplish. Explain technical details of reading, drawing, saving, and page operation when the user asks. Provide full paths for candidate folders and explain size and existing results when they affect scope selection.

Retain the user's language preference. Once Chinese is selected, use Chinese for conversation and results. Start in English when the first-use language preference remains undecided and mention Chinese support.

Use natural explanations of functions, such as “read records for later selection” or “save the selected results.” Graphs use understandable objects, actions, and results. Keep function names, fields, and implementation-location details in internal evidence. Show quantities, calculations, and conditions needed to understand methods and results in their corresponding nodes.

## Required presentation and writing rules

Apply this section to folder, file, and article graphs in both modes, and to user-facing pages and delivery explanations. ExtractStructure helps people understand structure, purpose, and actual connections. Follow the skill's established presentation. Apply user-requested changes to their specified scope. These requirements also govern presentation and writing guidance in references.

- **Use the existing visual structure.** Present content through existing nodes, groups, connections, and expansion. Additional visual regions, panels, banners, sidebars, legends, and explanatory components require an explicit user request. Requests for more explanation, background, or completeness use the established interface.
- **Describe structure and purpose directly.** Pages, nodes, connections, and delivery explanations state what objects do, how they connect, and what they produce. Explanations of capability boundaries, analysis boundaries, exclusions, and disclaimers stay outside the presentation. Follow the established selection process when users choose objects and scope.
- **Keep node names short and specific.** Name one clear purpose, object, or result, retaining identifying features. Examples: “Fit 256 combinations, evaluate 128” and “Pairwise modeling improves ranking from 0.9782 to 0.9959.” Use concrete content rather than generic labels such as “process data” or “effective method.” Give distinct topics their own nodes and keep paragraph-length explanations in appropriate detail.
- **Preserve substance in node explanations.** Use concise natural sentences for concrete objects, procedures, necessary conditions, or key results as appropriate. Concision retains information needed for understanding. Split complex content into concrete nodes within existing expansion structures: summarize topics above and explain substance below. Each explanation adds relevant content and uses compact prose.
- **Keep connection explanations brief.** Use one short phrase for a concrete relationship, such as “provide selection criteria” or “generate summary report.” Existing interactive detail supports at most one short natural sentence. Each label conveys a single connection; background and boundary explanations remain outside connection text.
- **Use familiar words.** Express objects, actions, and results in everyday language. Keep necessary domain terms tied to concrete use. Store technical names used only for locating implementation in internal evidence. Show research objects, necessary assumptions, core calculations, and key values with the corresponding content.
- **Derive meaning from the source.** Node, group, and connection meanings come from code or documents actually read. Every function, connection, and explanation has an observed basis in that material.

## Phase 1: Review and agree on scope

### 1. Introduce both modes and select an object

**On first loading or using ExtractStructure, the first formal guidance reply must deliver the complete fixed introduction below before recommending current files and folders. Use a complete natural translation in the user's language, retaining every paragraph. Keep all three introductory paragraphs and connect the last sentence to the actual environment scan. When the user has specified an object, acknowledge it immediately after the introduction.**

> Hello! ExtractStructure can help you turn an article or a project into a visual structure.
>
> For text, give me a Markdown (`.md`), TeX (`.tex`), or PDF (`.pdf`) file, such as a research paper. I will read and understand it in depth, then draw its overall structure.
>
> For code, give me the path to a code repository. I will map the project's functions and responsibilities and show how its parts collaborate. You can also select any file or subfolder to explore further.
>
> I have scanned the current environment...

Use the user's chosen ExtractStructure name in the introduction. Retain the first three paragraphs in full, then connect the last sentence to the actual scan and recommendations.

Before this guidance reply, briefly inspect user attachments, the current file listing, existing documentation, and a few representative contents to obtain actual scan results. Follow the introduction with recommended projects, documents, or articles, usually about three entry points. Give each a one-sentence description and full path; retain uploaded filenames. Adjust the number to available objects, and optionally offer the current engineering project as an entry point. Invite a choice when the user is still selecting.

When suitable objects remain to be supplied, say after the introduction: “I haven't found a suitable project or text to analyze yet. You can upload Markdown, TeX, or PDF files, or provide a code repository path.” Follow an already specified object. Include developer feedback contact information according to the first-delivery rule.

Keep the introduction and recommendations at the level needed to choose an object. A selected repository follows the folder-size, existing-graph, and analysis workflow below. Selected text follows the text-scope workflow. A directly specified code file follows file analysis.

### 2. Text mode: Select article scope

Inspect the title, sections, and length, then briefly explain the article's main topic. Locate Markdown and TeX by original headings and paragraphs; locate PDFs by actual pages, sections, and page content.

**For TeX above 500 lines or PDFs above 10 pages, offer scope choices and wait for a decision.** For multi-file TeX, count the main file and actual included body text. For long or multi-topic Markdown, recommend a scope based on reading size. Retain an explicit user choice of full text, sections, or main body.

Offer choices based on actual content, with a brief description of each:

1. **Full text.** Cover the whole article, including appendices when present.
2. **Main body.** Offer when appendices exist, describing the main questions, methods, and results covered.
3. **Selected sections.** Recommend one or two actual section combinations, explaining their content and allowing another user selection.

Read the chosen content in depth and understand claims and reasoning before extracting structure. For research articles, use “Research article analysis and information retention” below as a reading guide. Upper levels organize main questions or topics; lower levels develop claims, methods, derivations, evidence, and results according to their actual role. Connections briefly express real relationships such as “measure,” “support the claim,” or “derive the conclusion.” Headings support navigation and reading; article meaning determines groups.

Save original evidence: headings, paragraphs, and line numbers for Markdown; sections, original labels, and line numbers for TeX; pages and corresponding paragraphs, equations, or figures for PDFs. Then select existing graphs and follow shared drawing and delivery. For short texts, use the full text unless the user chooses otherwise.

### 3. Repository mode: Assess analysis size

Use file listings to count Python and Markdown files separately, their combined total, and major branches. Read detailed content during execution. Omit `__init__.py` from folder listings. Programs skip ExtractStructure's own folder, version control metadata, and Python environments. Recommend treatment of backups, historical material, and local outputs based on actual purpose.

For a combined total of up to 100 Python and Markdown files, continue with the selected scope. Above 100, briefly describe size, main file types, and major branch purposes, recommend a scope, and wait for a choice:

1. **Analyze the recommended scope.** Describe included branches and file counts, plus skipped major branches, archives, backups, or local outputs.
2. **Analyze everything.** Cover all candidate files inventoried.
3. **Choose a custom scope.** Let users name included or skipped branches and provide one short example when useful.

List relevant branches as “path — approximate purpose; file count.” Explain historical archives too; mark uncertain purposes for confirmation. Summarize the agreed inclusion and count, then continue.

### 4. Look for reusable results

Internally inspect this project's or article's existing folder, file, or article graphs within the skill. Start analysis and drawing when there are no existing graphs. Otherwise assess suitability using original-file changes, briefly explain reuse or updates, and ask the user; recommend reuse when appropriate. Retain an existing decision.

When file graphs exist, use this wording in the user's language with actual counts and both choices in bold:

> Some files already have cached graphs, covering X/Y files in this scope. Would you like to **redraw and replace these cached graphs**, or **reuse them**?

X is the number of usable existing file graphs; Y is the selected file count. Repository mode counts Python and Markdown together; text mode counts selected text files. Replacement affects graph caches; original files retain their content. If only a folder overview exists, explain that it has a cached graph, offer the same two bold choices, and identify what replacement affects. Separate overview and detail choices when useful.

Inventory data supports internal work. Explain changes that actually affect user choices, for example: “Two files were added; I recommend updating the overview.”

## Phase 2: Analyze, draw, and deliver

Repository mode follows the steps below after agreeing on folder, scope, and existing results. Text mode organizes the agreed article structure into an expandable article graph, then follows steps 5 and 6. Both modes use the current drawing components.

1. **Explain the whole first.** Use one or two sentences for the folder's work, then explain file purposes.
2. **Find actual collaboration.** Describe which file supplies what, who receives it, and what results, saving original code or document locations. Apply “Markdown analysis and relationships” below to connections with code. Keep independent files as independent nodes.
3. **Draw a two-level folder graph.** The upper level summarizes main functions; the lower level shows files and collaboration. A file serving several functions appears once with its actual connections.
4. **Connect file details.** By default complete internal function graphs for selected files and connect them to the overview. Follow choices to show only the overview or reuse existing details. Analyze Python by functions and concrete processes; Markdown by purpose, topics, and specific explanations.
5. **Write clear graph text.** Follow the required presentation and writing rules for concise names and connections explaining objects, roles, and results. Write English first, then natural Chinese. Keep source locations and implementation-location details in graph data; show concrete procedures, conditions, and outcomes needed for understanding in nodes. Follow the user's selected translation scope for existing graphs.
6. **Deliver an accessible page.** Save graph data, start the internal service, and obtain a real accessible address. Folder tasks open the selected folder graph with all expandable nodes collapsed. Text or individual-file tasks open that article or file graph with the same collapsed initial state. Explain in one or two sentences what it shows and how to expand it. Add the developer contact note on the first result delivery. Perform content and page checks when requested, within the specified scope.

After scope selection, read [Folder analysis](references/folder-analysis.md). Purpose and main functions: Explain folder responsibilities, file collaboration, and subfolders so readers can move from the overview to individual files. Scope: Use when creating or updating a selected folder's function graph. Retain the agreed folder, file scope, and treatment of existing results.

For file internals, read [File analysis](references/file-analysis.md). Purpose and main functions: Explain a file through expandable functions and concrete processes, so readers can move from its overall purpose to its internal behavior. Scope: Use when creating or updating the internal function graph of a selected Python file, whether selected from a folder or specified directly by the user.

For inventory, drafts, saving, or serving pages, read [Graph data and storage](references/graph-format.md). Purpose and main functions: Describe internal draft fields, source locations, bilingual content, commands, and result storage. Scope: Use this skill's programs to create, save, link, or open graph data. This document guides internal program operation; explanations to users follow the folder and file analysis guidance.

## Research article analysis and information retention

Use this section for research papers and articles in text mode. Read selected originals in depth, find these common elements, understand their connections, and organize the graph:

- **Background.** Identify the research object, existing knowledge, and actual applications.
- **Motivation.** Explain the concrete questions left by existing methods or understanding and why this work studies them.
- **Contributions.** Identify new findings, methods, or evidence, using the article's actual distinctions: “Contribution 1: concrete content,” “Contribution 2: concrete content,” and so on.
- **Related work.** Explain what earlier studies actually did and how they connect to this work's questions, methods, and contributions.
- **Methods.** Explain selection of inputs and research objects, operations, comparisons, calculations, and resulting outputs.
- **Assumptions.** Identify specific conditions used by methods, theorems, or derivations and connect them to their results.
- **Theory.** Explain each theoretical result, its conditions, core relationships, and derivation evidence.
- **Corollaries.** State which further conclusions follow from which theories or conditions.
- **Experiments.** Identify objects, tasks, comparisons, controls, and key numerical or observed results.
- **Conclusions.** Explain what theory and experiments jointly support and how they answer the initial questions.

Use these elements as a reading guide; actual article content determines grouping. Include elements present in the original and expand multiple contributions, assumptions, theories, or experiments separately. An element can span several concrete nodes, with counts determined by what is needed to explain its substance. Original documents retain their content; nodes faithfully extract or paraphrase meaning and preserve evidence.

Upper levels summarize topics; lower levels retain concrete substance. Each concrete node should explain what the authors studied, did, or found. Experimental nodes keep objects, controls, and key values needed to understand results; method nodes retain key steps and computational meaning; theory nodes retain results and necessary conditions. Split large amounts of content into connected expandable nodes.

For example, expand “sampled fitting” into “select 16 features” and “fit 256 combinations, evaluate 128.” For “pairwise modeling improves prediction,” retain “ranking correlation increases from 0.9782 to 0.9959,” then connect equal-parameter controls and actual repeated-split results. Replace example objects and numbers with original content during analysis.

Connections express supported relationships, such as “motivate the research question,” “provide validity conditions,” and “support contribution 2.” Keep shared content as one concrete node linked to every actual role. Explain theoretical results, observations, and author interpretations according to their own meaning. Every node and connection refers to a position in the selected original.

## From the developer — First-delivery feedback

On the first delivery of a viewable result in each conversation, append the following contact message after the page link and brief usage explanation, using the user's language:

> If you are not satisfied with the result, please submit an issue on GitHub or contact me at hma232@wisc.edu.
>
> 如果结果不令你满意，请在 GitHub 提交问题报告，或联系我：hma232@wisc.edu。

When a project GitHub address is known, link “submit an issue” to its issue-reporting page. Include this message in the first result-delivery reply. Keep introductions, scope selection, subsequent deliveries, and visualization pages in their established form.

## Markdown analysis and relationships

Markdown and Python files share folder nodes, file details, existing-result handling, and progressive exploration. For documents, explain overall purpose before main topics and specific details, saving headings, paragraphs, and original line numbers as evidence. Headings support navigation; content determines graph groups.

Classify Markdown by its actual role in the current work:

- **Input.** Supply requirements, rules, data, or instructions actually used by code or agents. Connections run from the document to consuming code and explain what is supplied and how it is used.
- **Output.** Be generated or organized by code, or written using code information, such as runtime reports, interface descriptions, and source analysis. Connections run from the producing or supplying code to the document and describe the result.
- **Process.** Perform an intermediate role, such as organizing agent reading, decisions, and later operations. Explain actual inputs, guidance, and connections before and after it.
- **Independent.** General background, folder descriptions, and reading guidance usually appear as independent gray nodes. When reading establishes actual input, output, or processing roles, classify and connect accordingly.

Base relationships on code behavior, concrete document requirements, and actual use. Filenames, links, and shared topics help locate related content; actual purpose determines connections. Independent nodes retain their own positions and detail entries. Classify a document's overall role and internal topics separately.

Current folder inventory and file assembly primarily serve Python: folders collect `.py`, and file details locate classes and functions through Python syntax. For Markdown, TeX, and PDF, the agent supplements text listings, reads originals, locates evidence using text-mode methods, and uses shared saving and display components. Python-specific reference methods apply to Python; Markdown analysis and relationships follow this section. Program extensions follow user-approved scope.

## Page use and result storage

Top navigation browses levels like a file browser. Folder paths open folder graphs; filenames open existing detail graphs. Use independent subfolder graphs when available. When a parent graph covers a subfolder, display its files and collaboration from that parent.

Deliver the selected folder or file's own path with all expandable nodes collapsed. Keep its overall view; users locate, highlight, and expand content after opening.

Drawing components handle compact layout, expansion, connection labels, highlighting, and languages. Store projects separately under this skill's `results/<project-id>/`. Deliver graph data and page links by default. Agree on delivery for standalone pages or static images when explicitly requested.

New and reused graph data share these page defaults:

- **Fixed within groups, compact between groups.** Keep concrete file/process positions within groups; allow whole-group movement on expansion. A collapsed overview occupies one card; expanding everything restores the full lower-level layout.
- **Immediate interaction.** Expansion, collapse, location, and view movement switch immediately. Connection label placement runs in the background while browsing stays responsive.
- **Mineral Atlas themes.** Follow the system initially and remember manual choices. Show four category colors at bottom right; cards use translucent category fills, expanded regions match the canvas, and highlights retain category colors.
- **Simple toolbar and connections.** Keep search, expand/collapse all, and zoom. Connections explain actual collaboration, with relationship classifications and badges omitted.
- **Deduplicated connection labels.** Merged labels express a distinct shared purpose. When only branch labels are meaningful, show each once. Keep concatenated text for internal relationship reading and use the distinct labels on the current view.
- **Saved categories.** For new or redrawn graphs, classify overview and concrete nodes independently as input, process, or output based on actual responsibilities and context. Zero-connection nodes are independent and gray. Save categories with the graph; arrow direction supports preliminary inference for nodes awaiting labels.
- **Transparent labels.** Use transparent areas with width at least height, allowing slight nearby-border overlap while keeping text and connections clear. Node names and path navigation convey ownership.

For graph generation, reuse, delivery, or presentation changes, read [Presentation and interaction](references/presentation.md). Purpose and main functions: Describe ExtractStructure's established visual, layout, interaction, and performance requirements, and identify the shared page resources responsible for them. Scope: Use when generating or reusing ExtractStructure graph data, delivering pages, or modifying this skill's drawing and presentation resources.

Analysis and drawing read selected code and documents. Changes to originals or the skill, old-result deletion, additional tests, and browser checks follow explicit user authorization. Saving checks that required drawing fields are complete so the page can load. Explain functional accuracy and readability based on actual reading or requested checks.
