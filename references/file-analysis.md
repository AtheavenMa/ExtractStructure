# File analysis — Understand how a file does its work

## Purpose and main functions

Explain a file through expandable functions and concrete processes, so readers can move from its overall purpose to its internal behavior.

## Scope

Use when creating or updating the internal function graph of a selected Python file, whether selected from a folder or specified directly by the user.

## Understand the file's role

Use the user's background and interests, and read the entire source file. Read important neighboring files when needed to understand inputs, outputs, and usage. Start with one to three sentences explaining what the file processes, what it provides, and its role in the folder.

For example: “This file selects records using the user's criteria, keeps the required records, and explains how the other records were handled.” Identify a purpose inferred from source as an interpretation based on reading. Describe differences between user expectations and program behavior separately.

## Read concrete processes before grouping functions

Follow inputs through to results, identifying important operations, decisions, and changes. For each important activity, ask:

1. What actually happens?
2. Which data, objects, or records change?
3. What does that change help accomplish?

For example, “update a progress field” can become “make overall progress reflect the completion of individual tasks.” Explain the actual purpose on the graph; keep field names and calculations in the source evidence.

The lower level explains concrete processes such as “read selection criteria,” “check whether a record meets the criteria,” and “keep selected records.” The upper level groups these into understandable functions such as “determine which records this report needs.” Readers see the overview first and click to expand the process.

## Explain conditions, results, and connections

Each connection should form a meaningful sentence: “The first item affects the second through this action.” Examples include “provide selection criteria” and “pass selected records to report preparation.”

Preserve conditions that change results, repeated processing, failure handling, and cleanup. Examples: “record a missing-date note when the date is absent” and “organize records one by one until processing is complete.” Show actual return paths when work returns to an earlier step.

Distinguish reading data, producing results, and changing existing content. Describe ordering guaranteed by the source. When an external program's internals still need reading, explain the inputs this file supplies, how it uses the results, and what remains to be confirmed.

Function and variable names locate source code. Graph names explain concrete objects, actions, and results. Keep domain terms needed for understanding and explain their meaning in this file when first introduced.

## Show work completed together

Group multiple code sections under one function when they serve a shared purpose. Keep a shared implementation as one item and record every function it participates in; the page assigns it a primary position.

Connections between upper-level functions should be traceable to actual lower-level processes. Names, connections, and explanations at each level should make that level's capability clear.

Keep formulas, numerical details, and program names for complex calculations in implementation notes. When a value directly affects the reader's judgment, explain what it measures and how it affects the result. Example: “Include the record when its timestamp is later than the selected date.”

## Prepare results for further reading

Save source locations for important content so the user or agent can return to the evidence. Explain the file's overall purpose, necessary background, and meanings still to be confirmed. English and Chinese use the same content and connections; filenames and source locations retain their original values.

Connect file graphs to the folder overview through filenames. For a directly selected file, deliver its page, explain its main work, and identify the function readers can click to explore further.
