# Presentation and interaction

## Purpose and main functions

Describe ExtractStructure's established visual, layout, interaction, and performance requirements, and identify the shared page resources responsible for them.

## Scope

Use when generating or reusing ExtractStructure graph data, delivering pages, or modifying this skill's drawing and presentation resources.

## Shared pages for new graphs and existing results

Article, folder and file graphs use this skill's `assets/viewer/`. The agent writes functional explanations, actual relationships, source evidence, and bilingual content; shared components handle layout, themes, text placement, and interaction. New projects and existing results follow the same defaults. Refresh the page after presentation resources change.

The path navigation appears on the first row to the right of ExtractStructure, using the system sans-serif font at 16px, weight 600, and the theme accent color; the brand is 18px. Paths support navigation between levels and horizontal scrolling for long paths.

Deliver the selected article, folder or file's own address or exported page with every expandable node initially collapsed. Folder tasks open the selected folder's overview. The page responds when users expand, locate content, or switch language.

## Layout and nodes

- The upper level (L1) summarizes functions. Borders and side bars use each node's category color; expanded group borders use the same color.
- The lower level (L2) shows concrete files or processes and preserves saved relative positions within groups. Expanding everything uses the full L2 reference coordinates.
- Mixed expansion states arrange visible function groups compactly. Expanded groups can move as units; collapsed groups occupy one L1 card. The view fits visible content to reduce empty space.
- The page reads `display.presentation.layout.collapse_layout`. The default `"compact"` uses the behavior above. When the user explicitly requests fixed absolute positions, `"fixed"` reserves the complete reference layout.
- Function names and descriptions within cards use 12px, weight 400, and the theme's main text color. Count badges and interaction indicate expansion. Center filenames and descriptions vertically as a single text block with consistent line spacing and padding.
- Expanded group titles have transparent backgrounds and retain their full click areas. Nodes show names, purposes, and applicable filenames. Groups, node names, and path navigation convey ownership; small external ownership labels remain omitted.

## Names and explanations

A card name identifies one concrete topic, action or result. Its `meaning` preserves the explanation needed to understand it. Current cards are 230 × 72 pixels. As drafting guidance, aim for about twelve Chinese characters or twenty-one Latin characters per row, with up to four rows; folder cards reserve an additional filename row. Actual wrapping depends on words and fonts.

The viewer abbreviates overflow with an ellipsis while preserving the original graph text. Hover or keyboard focus shows the complete name and explanation in a shared tooltip. Escape dismisses it. Clicking retains the established expansion and selection behavior. Translations include both names and explanations.

Expanded topic regions use the same base margins for every topic. Geometry and nearby nodes determine merging and separation. A region can have several pieces when its members surround other nodes. Topic names, order and content follow source meaning.

## Connection labels

Connections describe concrete collaboration through `label` and `description`. Relationship type classifications, badges, and filters remain omitted. The toolbar provides search, expand/collapse all, and zoom; the canvas automatically fits on opening and expansion changes.

Connection labels use transparent text areas whose height is at most their width. Text uses the theme text color; fill and stroke remain transparent. Click areas and visual backgrounds are handled separately.

Text areas may slightly overlap nearby borders; the current allowance is 4 pixels. Node content, other labels, and connection lines remain clear. Transparent text areas leave room for connection lines. Leader lines associate labels with their connections.

Deduplicate merged and branch labels using the same underlying relationship members. When branch labels describe distinct roles and a merged label merely concatenates them, show the individual branch labels. A merged label can express a distinct shared purpose; it also serves branches with exactly the same label. The combined text remains available when clicking a segment to read full relationships. Deduplication preserves actual connections and clickable members.

## Mineral Atlas colors

| Object | Presentation |
| --- | --- |
| Deep Mineral dark theme | Dark graphite canvas and matching expanded regions, translucent category-colored nodes, soft white text. |
| Limestone Paper light theme | White canvas and frame, matching expanded regions, translucent category-colored nodes, dark green text. |
| L1 overview | Use each node's input, process, output, or independent category color; expanded borders, selection, and focus retain that color. |
| Input, process, output, independent | Blue-gray, emerald, copper, and gray for borders, side bars, translucent fills, and legends. |
| Ordinary connections | Neutral theme connection colors; highlighted paths use emerald. |
| Expanded groups | Canvas-matching backgrounds, thin borders, and clear titles. |
| Filenames | Neutral main text color and monospace font, with links indicating clickability. |
| Connection text areas | Transparent; text follows the theme. |

Color values reside in `assets/viewer/atlas-shell.css` as `--atlas-*` variables, referenced by component role. Use a solid canvas. Initially follow the system theme, then remember manual choices. Switching themes preserves graph coordinates and expansion state.

## Fonts

Use system sans-serif fonts for English UI, available system Chinese fonts for Chinese text, and system monospace fonts for code and filenames. The browser selects available fonts on each device. Font stacks and typography roles use `--atlas-font-*` and `--atlas-type-*` variables in `atlas-shell.css`.

| Role | Size and weight |
| --- | --- |
| Product name | 18px, 600 |
| Expanded group titles | 13px, 600 |
| Filenames | 13px, 500, Mono; consistent across nodes |
| Function names and descriptions inside cards | 12px, 400, theme main text color |
| Connection labels | 12px, 500 |
| Toolbar | 13px, 500 |
| Bottom node and relationship counts | 14px; 13px on narrow screens |
| Bottom interaction hints | 12.5px |

The viewer uses fonts available through the browser and operating system. Retain the established font sizes, weights, colors, spacing, card dimensions, graph coordinates, and layout rules. Font appearance and text wrapping may vary across devices because system fonts have different character widths.

## Interaction and performance

Bottom hints explain expansion, collapse, relationship highlighting, and scroll zoom in that order. Both language versions omit Shift-drag text; dragging retains its current behavior.

Expansion, collapse, search navigation, and view movement switch immediately. The browser continues accepting input while labels are placed. Workers run label placement in the background. Where workers are unavailable, deferred page computation provides the same labels, with computation time depending on graph complexity. Switching views cancels pending work; the current view receives results corresponding to its own layout.

Start label placement with a small set of good candidates and expand the search for difficult labels. Use spatial indexing for nearby collision checks and reuse computed candidates across retries. Cache label positions and connection paths by view; collapse and re-expansion reuse current-session results.

When the user requests performance investigation, measure data loading, nodes and connection paths, label candidate generation, position assignment, and retries separately. Distinguish initial computation, cache hits, and time until the page accepts input, using measurements from the current environment.

## Service and independent pages

The same viewer resources serve both delivery modes. Service pages request graph data from the local service. Independent HTML embeds the selected graph, its available descendant graphs and ancestor navigation, along with scripts, styles and worker resources. Internal navigation uses URL fragments in independent pages. Language switching rebuilds the current graph in place and retains expansion, view and search, including after asynchronous connection labels finish; theme switching keeps the current geometry. Browser storage is optional for the running page.

Export creates a self-contained file. Host attachment, hosting and port forwarding tools determine how users access it. The initial graph and collapsed state follow the selected task object.

## Files to locate during maintenance

| File | Responsibility |
| --- | --- |
| `scripts/layout.py` | Generate full L2 reference coordinates. |
| `assets/viewer/expansion_layout.js` | Arrange function groups compactly for the expansion state while retaining L2 positions within groups. |
| `assets/viewer/viewer.js` | Render nodes, connections, and transparent labels; manage highlighting, framing, and view caches. |
| `assets/viewer/inline_labels.js` | Organize connection labels, constrain dimensions and border overlap, select positions, and reuse candidates. |
| `assets/viewer/caption_worker.js` | Compute label placement in the background. |
| `assets/viewer/atlas-shell.css`, `viewer.css` | Define theme colors, page layout, and component display states. |
| `assets/viewer/i18n.js` | Manage language and theme preferences and restore views when language changes. |
| `assets/viewer/bootstrap.js` | Load the current graph and organize folder and file navigation. |
| `assets/viewer/runtime.js` | Read server or embedded data, navigate results, and create background workers with a page-computation fallback. |
| `scripts/export_page.py` | Package selected graph navigation and the shared viewer into an independent HTML file. |
| `scripts/server.py` | Serve page resources and graph data, including resources for background placement. |

Implement presentation changes in shared resources. Graph data continues storing meanings and full L2 reference coordinates. Reuse and replacement of existing content follow the user's selection.

## Input, process, output, and independent nodes

| Category | Determine by its actual role in the current graph |
| --- | --- |
| `input` | Obtain files, code capabilities, external information, or human input for the main function, or serve as a logical starting point. Actual use of external capabilities is input; an import alone is a source reference. |
| `output` | Deliver files, feedback, usable results, or valuable external resources, including archives, reports, and logical outcomes. |
| `process` | Perform internal checks, conversion, computation, or organization. Producing an intermediate value alone does not determine the category. |
| `independent` | Have zero incoming and outgoing connections in the complete relationships for that level. |

Set `category` independently at each level: `input` uses blue-gray, `process` emerald, and `output` copper. Classify parents by overall responsibility and children by their own actual roles. Preserve each explicit category. New and redrawn graphs specify categories for groups and concrete nodes in drafts; generation preserves them. Existing graphs retain their meanings; page inference serves nodes that still need a category.

For nodes awaiting a category, infer from complete relationships at that level: outgoing-only is input, incoming-only is output, both is process, and zero connections is independent (`independent`, gray). Expansion and collapse continue using complete relationships for classification.

Every page shows the same four categories at bottom right: input, process, output, and independent. English, Chinese, dark, and light versions use the same items and larger swatches, with colors adjusted to the theme. Collapsed cards and leaf nodes use translucent category fills. Group borders use parent colors; expanded regions use the canvas background.

Hover, selection, keyboard focus, and group focus retain each node's category color in borders and fill, using border width and opacity for feedback. Expanded group border and title highlights use that group's color.

## Optional developer checks

When viewer verification is requested, `tests/check_viewer.py` accepts any saved viewer URL or exported HTML path. It checks collapsed opening, node explanations, expansion and language restoration after labels finish. Supply `--sandbox` with an HTML file to exercise an opaque frame; `--worker-mode blocked` or `--worker-mode load-error` exercises fallback computation. The check uses the host's optional Playwright package and Chromium browser; graph generation and export keep their standard-library runtime. Store any downloaded browser runtime and captured reports in a named directory under this skill's `results/tasks/`. The check prints its observed result as JSON.

```bash
python <skill-directory>/tests/check_viewer.py <exported-html-path> --sandbox --worker-mode blocked
```
