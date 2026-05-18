# GlideIt 🚀

GlideIt is a beautiful, powerful CLI tool built from scratch that parses a software project's codebase (Python and JSX/React) and produces an interactive, fully-functional visual output. The resulting visualization is a navigable node graph showing every function, component, API route, variable flow, and call relationship. 

It generates a standalone output in `glideit-out/` that can be opened in any browser with **zero internet connection** and **no local server required**!

---

## 🌟 Features

- **Language-Agnostic Extractor Architecture**: Modular design for extractors makes it easy to support new languages in the future.
- **Python Static Code Analysis**:
  - Extracts all class and function definitions, parameters (with type-hints), and return types.
  - Detects Flask routing decorators (`@app.route`, `@blueprint.route`) and details them as route entry-points.
  - Traces function-level variable assignments.
- **JSX/React & TSX Static Code Analysis**:
  - Extracts React functional and class components.
  - Maps component-to-component render trees.
  - Identifies Hook usages (`useState`, `useEffect`, etc.).
  - Extracts external HTTP client requests (`fetch` and `axios` calls).
- **Interactive Visual Canvas**:
  - Pan, zoom, and expand node views.
  - Visually distinct representation for Python functions, Flask routes, React components, and external calls.
  - Hierarchical layouts powered by `dagre` (entry points at the top, deep logic below).
  - Clean styling with a gorgeous dark mode palette.

---

## 📂 Project Architecture

```text
glideit/
├── glideit/
│   ├── __init__.py
│   ├── cli.py               # CLI command-line entry point
│   ├── walker.py            # Project scanner and gitignore handling
│   ├── graph.py             # Graph builder & JSON serializer
│   ├── extractors/
│   │   ├── __init__.py
│   │   ├── base.py          # Base extractor interface
│   │   ├── python_extractor.py
│   │   └── jsx_extractor.py
│   └── renderer/            # React + Vite visualization client
│       ├── package.json
│       ├── vite.config.js
│       ├── index.html
│       └── src/
│           ├── main.jsx
│           ├── App.jsx
│           ├── components/
│           │   ├── Navbar.jsx
│           │   ├── CodeFlowPage.jsx
│           │   ├── ApiPage.jsx
│           │   └── JsxPage.jsx
│           └── styles/
│               └── index.css
├── pyproject.toml
└── README.md
```

---

## 🛠️ CLI Usage

GlideIt packages as a standard Python CLI tool.

### Command

Run the following command from the root of your project:

```bash
glideit run
```

### Supported Flags

- `--output <dir>`: Customizes the destination for the visualization bundle (defaults to `glideit-out/`).
- `--version`: Prints the current version of the tool.
- `--help`: Shows command usage and options.

---

## 🎨 Visualization Interface

The generated bundle contains three core views accessible from a floating pill-capsule navbar:

1. **Code Flow**: A zoomable canvas representing all Python functions and their invocation graph (solid for direct calls, dashed for nested calls).
2. **API**: A dedicated dashboard for Flask route entry points grouped by Blueprints, displaying HTTP verbs and handler links.
3. **JSX Components**: A dedicated hierarchy mapping of React components, their properties (props), hook usages, and API requests.

---

## 📦 Requirements

- **Python**: `tree-sitter`, `tree-sitter-python`, `tree-sitter-javascript`, `pathspec`
- **Node.js**: Recommended for compiling the built-in React renderer during packaging/development phases.
