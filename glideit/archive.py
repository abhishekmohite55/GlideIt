"""
Archive utilities — create, list, and delete graph snapshots.

Archives are stored in <output_dir>/archives/ as:
  <name>-<short_hash>.json
  index.json   (metadata)
"""

from __future__ import annotations

import hashlib
import json
import random
import shutil
import time
from pathlib import Path
from typing import Any

_ADJECTIVES = [
    "brave", "calm", "eager", "fierce", "gentle", "happy", "keen", "lively",
    "mighty", "noble", "proud", "quick", "rapid", "sharp", "swift", "bright",
    "cool", "deep", "bold", "wise", "agile", "brisk", "crisp", "daring",
]

_NOUNS = [
    "eagle", "falcon", "hawk", "lion", "panther", "phoenix", "raven", "tiger",
    "wolf", "bear", "deer", "fox", "hare", "kiwi", "lynx", "otter", "puma",
    "rook", "seal", "swan", "elm", "maple", "oak", "pine",
]


def _generate_name() -> str:
    return f"{random.choice(_ADJECTIVES)}-{random.choice(_NOUNS)}"


def _short_hash(content: str) -> str:
    salt = f"{time.time_ns()}{random.randint(0, 999999)}"
    return hashlib.sha256(f"{salt}:{content}".encode("utf-8")).hexdigest()[:6]


def _archives_dir(output_dir: Path) -> Path:
    return output_dir / "archives"


def _index_path(output_dir: Path) -> Path:
    return _archives_dir(output_dir) / "index.json"


def _load_index(output_dir: Path) -> list[dict[str, Any]]:
    path = _index_path(output_dir)
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text("utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _save_index(output_dir: Path, index: list[dict[str, Any]]) -> None:
    _archives_dir(output_dir).mkdir(parents=True, exist_ok=True)
    _index_path(output_dir).write_text(
        json.dumps(index, indent=2, default=str), "utf-8"
    )


def create_archive(
    output_dir: Path,
    graph_path: Path | None = None,
    name: str | None = None,
) -> dict[str, Any]:
    """
    Create an archive snapshot of graph-data.json.

    Args:
        output_dir: The output directory (glideit-out/) containing graph-data.json.
        graph_path: Explicit path to the graph JSON file (defaults to output_dir/graph-data.json).
        name: Optional custom name. If omitted, a random adjective-noun name is generated.

    Returns:
        Archive metadata dict.
    """
    if graph_path is None:
        graph_path = output_dir / "graph-data.json"

    if not graph_path.exists():
        raise FileNotFoundError(
            f"Graph data not found at {graph_path}. Run 'glideit run' first."
        )

    content = graph_path.read_text("utf-8")
    friendly_name = name.strip().replace(" ", "-") if name else _generate_name()
    friendly_name = "".join(c for c in friendly_name if c.isalnum() or c in "-_.")
    hash_suffix = _short_hash(content)

    archive_filename = f"{friendly_name}-{hash_suffix}.json"
    archive_dir = _archives_dir(output_dir)
    archive_dir.mkdir(parents=True, exist_ok=True)
    archive_path = archive_dir / archive_filename

    shutil.copy2(graph_path, archive_path)

    index = _load_index(output_dir)
    entry = {
        "id": hash_suffix,
        "name": friendly_name,
        "hash": hash_suffix,
        "filename": archive_filename,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    # Replace duplicate id if it somehow collides (very unlikely)
    index = [e for e in index if e["id"] != hash_suffix]
    index.append(entry)
    _save_index(output_dir, index)

    return entry


def list_archives(output_dir: Path) -> list[dict[str, Any]]:
    """Return all archive metadata entries."""
    return _load_index(output_dir)


def delete_archive(output_dir: Path, archive_id: str) -> bool:
    """
    Delete an archive by its id (short hash).

    Returns True if an archive was removed, False if not found.
    """
    index = _load_index(output_dir)
    match = [e for e in index if e["id"] == archive_id]
    if not match:
        return False

    entry = match[0]
    archive_path = _archives_dir(output_dir) / entry["filename"]
    if archive_path.exists():
        archive_path.unlink()

    _save_index(output_dir, [e for e in index if e["id"] != archive_id])
    return True
