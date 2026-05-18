# Patching 1.1 — Serving & Bundling Features

## Technical Patch Implementation Plan (All 3 Serving/Bundling Options)
Here is exactly how we will implement the served and self-contained options in our code:

### 1. The Single-File Offline Mode (`glideit run --single`)
* **Renderer Package**: Install `vite-plugin-singlefile` as a devDependency in `glideit/renderer/package.json`.
* **Vite Config (`vite.config.js`)**: Conditionally load `viteSingleFile()` only if the environment variable `VITE_SINGLE_FILE=true` is set during the build process.
* **React Core (`App.jsx`)**: Update the initial data loader. It will check for the global variable `window.__GLIDEIT_DATA__` first. If present, it loads instantly. If not, it falls back to the standard `fetch('./graph-data.json')` call.
* **Python Builder (`renderer_builder.py`)**:
  * If `--single` is active, it runs the Vite build with `VITE_SINGLE_FILE=true`.
  * It reads the compiled single-file `index.html` from `dist/`.
  * It reads the parsed `graph-data.json`.
  * It injects `<script>window.__GLIDEIT_DATA__ = <json_content>;</script>` directly into the HTML's `<head>` and saves that self-contained `index.html` to the target directory.

### 2. Serve Subcommand (`glideit serve`) & Auto-Serve (`glideit run --serve`)
* **Python CLI (`cli.py`)**:
  * Add `--serve` flag to `glideit run`.
  * Add `serve` subcommand (`glideit serve [directory]`).
  * Implement a serving module in Python using `http.server` and socket ports to host the output directory, and python's built-in `webbrowser` library to automatically launch a browser tab to `http://localhost:<port>`.
