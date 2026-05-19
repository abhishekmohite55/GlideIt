# GlideIt 🚀

GlideIt is a beautiful, powerful code mapping and visualization tool. It parses a software project's codebase (supporting Python, JavaScript, and JSX/React) and constructs an interactive, highly intuitive visual node graph showing every function, React component, API route, variable flow, and call relationship.

It produces a standalone visualization bundle in `glideit-out/` that can be viewed in any browser with **zero internet connection** and **no local server required**!

---

## 🌟 Key Features

### 🔍 Language-Agnostic Extractor System
*   **Modular Extractor Architecture**: Designed to be extensible, utilizing a common `BaseExtractor` interface powered by `tree-sitter` AST parsers.
*   **Python Static Code Analysis**:
    *   Extracts class and function definitions, parameters (with type-hints), and return types.
    *   Detects Flask routing decorators (`@app.route`, `@blueprint.route`) and labels them as API route entry-points.
    *   Traces function-level invocation dependencies and variable assignments.
*   **JSX/React Static Code Analysis**:
    *   Extracts functional and class components.
    *   Maps component-to-component render trees.
    *   Identifies React Hook usages (`useState`, `useEffect`, etc.).
    *   Extracts external HTTP API requests (`fetch` and `axios` calls).

### 🎨 Advanced Interactive Visualization UI
*   **ELK.js Layout Engine**: Automatically aligns, partitions, and renders complex call flows with high readability using `@layout-elk/elkjs`. No node overlaps or messy crossing lines.
*   **Dynamic Layout Controls**:
    *   **Layout Direction Toggle**: Instantly switch between Top-to-Bottom (`TB`) and Left-to-Right (`LR`) layout configurations.
    *   **Depth Slider**: Filter the visible canvas nodes dynamically by their execution/dependency depth from root components and API endpoints.
*   **Subsystem Cluster Coloring**: Uses a Breadth-First Search (BFS) partitioning algorithm to group nodes into independent codebase clusters. Each cluster is styled with a distinct pastel/neon color scheme.
*   **Context-Aware Hover Breadcrumbs**: Hovering over any node dynamically computes the call chain back to its root entry point, displaying a clear navigation trail at the top of the canvas.
*   **Focused Execution Highlights**:
    *   Clicking a node highlights it with a glowing neon border matching its subsystem color.
    *   Fades unrelated nodes (to `0.35` opacity) and edges (to `0.1` opacity) to emphasize context.
    *   Displays animated flow dots on active outgoing connections.
*   **Rich Navigation & Keybindings**:
    *   Hold `Space + drag` to pan the canvas seamlessly.
    *   Navigate/pan using Arrow keys.
    *   `Ctrl + Shift + F` to fit the whole graph to the screen.
    *   `?` key to slide open the interactive **Legend Panel & Shortcut Reference** panel.

---

## 📂 Project Architecture

```text
glideit/
├── glideit/                  # Python source package
│   ├── __init__.py
│   ├── cli.py                # Command-line interface & custom threaded web server
│   ├── walker.py             # Gitignore-aware project file scanner
│   ├── graph.py              # Graph assembler & JSON serializer
│   └── extractors/           # Language extractors
│       ├── __init__.py
│       ├── base.py           # Common base extractor class
│       ├── python_extractor.py
│       └── jsx_extractor.py
├── renderer/                 # React + Vite frontend source code
│   ├── package.json          # Node dependencies including elkjs and xyflow
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── layout.js         # ELK-based node/edge layout utility
│       ├── clusterColors.js  # Curated palette for subsystems
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── CanvasToolbar.jsx  # Depth slider + layout orientation toggle
│       │   ├── LegendPanel.jsx    # Visual legend + shortcuts lookup
│       │   ├── BreadcrumbBar.jsx  # Hover-based trace indicator
│       │   ├── CodeFlowPage.jsx
│       │   ├── ApiPage.jsx
│       │   └── JsxPage.jsx
│       ├── hooks/
│       │   ├── useKeyBindings.js  # Global shortcut listeners
│       │   └── useSpacePan.js     # Spacebar pan controller
│       ├── utils/
│       │   └── findPathToRoot.js  # BFS back-trace path resolver
│       └── styles/
│           └── index.css     # Premium dark mode stylesheet
├── pyproject.toml            # Poetry/PIP build definition
└── README.md                 # Project documentation
```

---

## 🛠️ Installation & Setup

### Python Package Installation
To install GlideIt locally for development, clone the repository and run:
```bash
pip install -e .
```

### Frontend Development setup
To run the React renderer locally:
1. Navigate to the renderer directory:
   ```bash
   cd renderer
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Launch the Vite local dev server:
   ```bash
   npm run dev
   ```

---

## 💻 CLI Usage

Once installed, GlideIt exposes two primary subcommands: `run` and `serve`.

### 1. Run Pipeline (`glideit run`)
Parses the current repository directory, compiles the React renderer, and outputs a standalone visualization package.
```bash
glideit run [options]
```

**Options**:
*   `--output <dir>`: Target folder for the visualization output (defaults to `glideit-out/`).
*   `--serve`: Runs the parser, bundles the site, and immediately runs a local preview server.
*   `--help`: Details usage and flags.

### 2. Preview Server (`glideit serve`)
Starts a local web server to serve the already generated `glideit-out/` visualization bundle *without* re-parsing the codebase.
```bash
glideit serve [options]
```

**Options**:
*   `--port <number>`: Port to bind the server to (defaults to `8000`).

*Note: The built-in server runs on a background thread so it can be terminated cleanly at any time using `Ctrl+C` on Windows.*

---

## 📦 System Requirements

*   **Python 3.8+** (with `tree-sitter`, `tree-sitter-python`, `tree-sitter-javascript`, `pathspec` libraries)
*   **Node.js 18+** (required to compile the React client during builds)
