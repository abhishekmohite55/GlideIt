"""
Renderer builder — invokes `vite build` inside the renderer directory
and copies the output into the final glideit-out/ directory.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


# The renderer source is shipped alongside the Python package
_RENDERER_DIR = Path(__file__).parent / "renderer"


def build_renderer(output_dir: Path, graph_json_path: Path, single_file: bool = False) -> None:
    """
    1. Copy graph-data.json into renderer/public/ so Vite can include it.
    2. Run `npm install` (if node_modules missing).
    3. Run `vite build --outDir <output_dir>`.
    4. If single_file is True, inject graph JSON directly into index.html and clean up loose assets.
    """
    if not _RENDERER_DIR.exists():
        raise FileNotFoundError(f"Renderer source not found at {_RENDERER_DIR}")

    node_modules = _RENDERER_DIR / "node_modules"
    npm = shutil.which("npm")
    if npm is None:
        raise EnvironmentError(
            "npm not found on PATH. Install Node.js to enable the renderer build."
        )

    # ── npm install ───────────────────────────
    if not node_modules.exists() or not (node_modules / "vite-plugin-singlefile").exists():
        print("  Installing renderer dependencies (npm install)...")
        result = subprocess.run(
            [npm, "install"],
            cwd=str(_RENDERER_DIR),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"npm install failed:\n{result.stderr}")

    # ── Copy graph-data.json → renderer/public/ ──
    public_dir = _RENDERER_DIR / "public"
    public_dir.mkdir(exist_ok=True)
    shutil.copy2(graph_json_path, public_dir / "graph-data.json")

    # ── vite build ────────────────────────────
    print("  Running renderer build (vite build)...")
    vite = _RENDERER_DIR / "node_modules" / ".bin" / ("vite.cmd" if sys.platform == "win32" else "vite")
    
    # Configure environment variables
    env = os.environ.copy()
    if single_file:
        env["VITE_SINGLE_FILE"] = "true"
        
    result = subprocess.run(
        [str(vite), "build", "--outDir", str(output_dir), "--emptyOutDir"],
        cwd=str(_RENDERER_DIR),
        capture_output=True,
        text=True,
        env=env,
    )
    if result.returncode != 0:
        raise RuntimeError(f"vite build failed:\n{result.stderr}\n{result.stdout}")

    # ── single file injection ──────────────────
    if single_file:
        print("  Injecting graph data into single HTML bundle...")
        index_html_path = output_dir / "index.html"
        if not index_html_path.exists():
            raise FileNotFoundError(f"index.html not found in build output at {index_html_path}")

        # Read the generated index.html
        html_content = index_html_path.read_text(encoding="utf-8")

        # Read the graph data JSON
        graph_data_json = graph_json_path.read_text(encoding="utf-8")

        # Inject the script tag before the closing </head>
        injected_script = f"<script>window.__GLIDEIT_DATA__ = {graph_data_json};</script></head>"
        html_content = html_content.replace("</head>", injected_script, 1)

        # Write back the modified HTML
        index_html_path.write_text(html_content, encoding="utf-8")

        # Clean up loose files not needed in single file mode
        loose_json = output_dir / "graph-data.json"
        if loose_json.exists():
            loose_json.unlink()
        
        loose_assets = output_dir / "assets"
        if loose_assets.exists():
            shutil.rmtree(loose_assets)

