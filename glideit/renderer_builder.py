"""
Renderer builder — copies pre-built renderer assets to the output directory
and injects the graph JSON (single-file mode) or writes graph-data.json.
Does NOT run npm or vite build at runtime.
"""

from __future__ import annotations

import shutil
from pathlib import Path

# The renderer source is shipped alongside the Python package
_RENDERER_DIR = Path(__file__).parent / "renderer"


def build_renderer(output_dir: Path, graph_data: str, single_file: bool = False) -> None:
    """
    Copy the pre-built renderer assets to the output directory and inject/write the graph JSON.
    Does NOT run npm or vite build at runtime.

    Args:
        output_dir: Directory to write the visualizer assets into (cleaned first).
        graph_data: The serialized graph JSON string.
        single_file: If True, inject graph_data inline into index.html.
    """
    dist_dir = _RENDERER_DIR / ("dist-single" if single_file else "dist")
    if not dist_dir.exists():
        raise FileNotFoundError(f"Pre-built renderer not found at {dist_dir}")

    # Clean output dir to prevent leftover files from previous runs,
    # then copy fresh (copytree creates the destination directory itself)
    if output_dir.exists():
        shutil.rmtree(output_dir)
    shutil.copytree(dist_dir, output_dir)

    if single_file:
        print("  Injecting graph data into single HTML bundle...")
        index_html_path = output_dir / "index.html"
        if not index_html_path.exists():
            raise FileNotFoundError(f"index.html not found in pre-built files at {index_html_path}")

        html_content = index_html_path.read_text(encoding="utf-8")

        # Inject the script tag before the closing </head>
        injected_script = f"<script>window.__GLIDEIT_DATA__ = {graph_data};</script></head>"
        html_content = html_content.replace("</head>", injected_script, 1)

        index_html_path.write_text(html_content, encoding="utf-8")
    else:
        # Write the real graph-data.json (overwrites placeholder from dist)
        (output_dir / "graph-data.json").write_text(graph_data, encoding="utf-8")
