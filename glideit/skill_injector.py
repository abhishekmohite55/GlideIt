from __future__ import annotations

import logging
from pathlib import Path

from glideit.agent_registry import AgentInfo

logger = logging.getLogger(__name__)


def get_skill_content() -> str:
    skill_path = Path(__file__).parent / "skills" / "glideit-docstring" / "SKILL.md"
    if not skill_path.exists():
        raise FileNotFoundError(
            f"Bundled SKILL.md not found at {skill_path}. "
            "This is a packaging issue — try reinstalling GlideIt."
        )
    return skill_path.read_text(encoding="utf-8")


def inject_skill(repo_root: Path, agent: AgentInfo, skill_content: str) -> tuple[Path, str]:
    config_dir = repo_root / agent.config_dir
    target_path = repo_root / agent.skill_path

    action = "updated" if target_path.exists() else "created"

    config_dir.mkdir(parents=False, exist_ok=True) if config_dir.exists() else config_dir.mkdir(parents=True, exist_ok=True)

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(skill_content, encoding="utf-8")

    return target_path, action
