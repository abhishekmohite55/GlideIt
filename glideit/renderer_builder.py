"""
Renderer builder — invokes `vite build` inside the renderer directory
and copies the output into the final glideit-out/ directory.
"""

from __future__ import annotations

import shutil
from pathlib import Path

# The renderer source is shipped alongside the Python package
_RENDERER_DIR = Path(__file__).parent / "renderer"


def build_renderer(output_dir: Path, graph_json_path: Path, single_file: bool = False) -> None:
    """
    Copy the pre-built renderer assets to the output directory and inject the graph JSON.
    Does NOT run npm or vite build at runtime.
    """
    dist_dir = _RENDERER_DIR / ("dist-single" if single_file else "dist")
    if not dist_dir.exists():
        raise FileNotFoundError(f"Pre-built renderer not found at {dist_dir}")

    # Copy pre-built files
    shutil.copytree(dist_dir, output_dir, dirs_exist_ok=True)

    if single_file:
        print("  Injecting graph data into single HTML bundle...")
        index_html_path = output_dir / "index.html"
        if not index_html_path.exists():
            raise FileNotFoundError(f"index.html not found in pre-built files at {index_html_path}")

        html_content = index_html_path.read_text(encoding="utf-8")
        graph_data_json = graph_json_path.read_text(encoding="utf-8")

        # Inject the script tag before the closing </head>
        injected_script = f"<script>window.__GLIDEIT_DATA__ = {graph_data_json};</script></head>"
        html_content = html_content.replace("</head>", injected_script, 1)

        index_html_path.write_text(html_content, encoding="utf-8")
    else:
        # For standard build, copy the graph-data.json to the output directory
        shutil.copy2(graph_json_path, output_dir / "graph-data.json")
