# Patching 1.2 — Layout Flow & Zoom Optimization

## Technical Patch Plan

This patch resolves readability issues and initial zoom on large codebases, and refines CLI messaging around the server subcommands.

### 1. CLI Serve Subcommand Clarification
* **Issue:** When running `glideit run --serve`, the user expected only to serve the output, but the CLI printed parsing and building messages.
* **Explanation:** `glideit run --serve` is a single pipeline command meant to parse, build, and serve. To serve existing outputs *without* reparsing or rebuilding, the user should run `glideit serve`.
* **Action:** Improve help text in `cli.py` to clearly make this distinction so users know `glideit serve` is for running a server on existing output.

### 2. Left-to-Right Layout (`'LR'`)
* **Action:** Update Dagre graph layout call direction from `'TB'` (Top-to-Bottom) to `'LR'` (Left-to-Right) in both `CodeFlowPage.jsx` and `JsxPage.jsx` call sites to make call flows read like a natural book (Left to Right).

### 3. Dynamic Focal Initial Zoom (Python `main` & React page-level roots)
* **Goal:** Instead of fitting the whole graph (which makes large repos appear as a flat, unreadable thin line), we will zoom in elegantly on key starting points and their direct connections.
* **Implementation Details:**
  * Wrap `CodeFlowPage` and `JsxPage` in `ReactFlowProvider` to allow using `useReactFlow` hooks.
  * Implement an initial focus effect:
    * **Python Code Flow:** Locate `main` function (ending in `:main` or ID `main`), or the first few Flask routes. Find their outgoing calls, and center/zoom in smoothly (`fitView`) on that initial cluster.
    * **JSX Component Flow:** Locate page components or root components (nodes with depth = 0 / zero in-degree). Focus and zoom in on them and their children.
