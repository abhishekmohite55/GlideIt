# Planning

_Scratch pad. Dump ideas, requirements, and goals here. No structure needed — this is for thinking out loud. Once you're happy with the direction, tell the agent and it will move this into a phase._

---

## Project: GlideIt — Codebase Visualization Tool

**Goal:** Build a zero-cost, open-source CLI tool that parses a software project (Python/Flask + React/JSX) and produces a self-contained, interactive visual wireframe of the entire code structure — viewable in any browser, fully offline, no internet required.

---

## Two-Stage Architecture
GlideIt works as a two-stage pipeline:
1. **Parser Stage** — reads source code, outputs `glideit-out/graph-data.json` (the JSON contract)
2. **Renderer Stage** — consumes that JSON and produces the full interactive HTML output

The two stages are **strictly decoupled** by the JSON schema. Adding a new language = write a new extractor only.

---

## Core Requirements

### Parser Core
- `tree-sitter` for Python and JavaScript/JSX grammars
- `pathspec` for `.gitignore` respect; built-in fallback: `node_modules, __pycache__, .git, dist, build, .venv`
- Output: `glideit-out/graph-data.json` — flat JSON with `meta`, `nodes`, `edges`
- Strictly language-agnostic architecture (extractor pattern)

### Python Extractor
- Functions: name, file, line, params (name + type hint), return type, docstring
- Function calls within each function
- Classes: name, methods, parent class
- Imports
- Flask routes: `@app.route`, HTTP method, URL path
- Variable assignments at function scope

### JSX Extractor
- React functional components: name, file, props (+ types from PropTypes/TypeScript)
- React class components: name, state shape, lifecycle methods
- Component-to-component render relationships
- Hook calls: `useState`, `useEffect`, `useContext`, custom hooks
- `fetch()` and `axios` calls: URL, method → `external_call` nodes
- Import statements

### Graph JSON Schema
Node types: `python_function`, `flask_route`, `react_component`, `external_call`, `python_class`
Edge types: `call`, `nested_call`, `render`, `data_flow`, `import`
Depth rules: entry points (Flask routes, React page components) = depth 0. Direct calls = depth 1. Nested = depth 2+. Circular calls → mark back-edge, no infinite loop.

### CLI Behavior
- Command: `glideit run` from repo root
- No required arguments
- Flags: `--output ./custom-dir`, `--version`, `--help`
- Progress output: scanning → parsing Python → parsing JSX → building output → done
- Exit 0 on success, exit 1 on error with message

### Renderer
- Vite + React (bundled into the Python package at CLI build time)
- React Flow (MIT) for node canvas
- dagre layout for hierarchical positioning
- Geist font embedded in bundle (no CDN)
- Three pages via floating pill navbar: **Code Flow**, **API**, **JSX Components**

### UI/UX
- Dark by default, information density over decoration, progressive disclosure
- **Navbar**: pill/capsule, fixed top-center, does not scroll. Left: logo, Center: 3 nav items, Right: GitHub pill button. Background: rgba(26,26,26,0.92) with backdrop blur, border-radius 999px, 1px border #333333
- **Node**: rounded rectangle, colored left-border by type, expandable on click
- **Canvas**: pan (click-drag), zoom (scroll), minimap bottom-right 160x100px

### Color Palette
| Token | Value |
|---|---|
| Canvas background | `#0F0F0F` |
| Navbar/panels | `#1A1A1A` |
| Expanded node bg | `#242424` |
| Accent | `#1E90FF` |
| Text primary | `#F0F0F0` |
| Text secondary | `#888888` |
| Text tertiary | `#555555` |
| Default edge | `#3A3A3A` |
| Active/selected edge | `#1E90FF` |
| Python function border | `#1E90FF` |
| Flask route border | `#00C853` |
| React component border | `#AA00FF` |
| External call border | `#555555` |

---

## Execution Strategy (Roadmap)
- **Phase 1 — Parser Core**: CLI scaffolding, tree-sitter integration, Python extractor, JSX extractor, graph assembler → produces `graph-data.json`. Validate schema. No UI.
- **Phase 2 — Renderer**: Vite + React, React Flow canvas, 3 pages, node expand/collapse, CLI integration to invoke Vite build.
- **Phase 3 — Polish & UI**: Dark theme, Geist font, pill navbar, node color coding, edge labels, minimap, dagre layout, cross-platform testing.
- **Phase 4 — Future (post-v1)**: TypeScript, Go, search/filter, PNG/SVG export, watch mode.
