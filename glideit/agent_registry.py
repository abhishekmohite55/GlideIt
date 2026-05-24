from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class AgentInfo:
    id: str
    display_name: str
    config_dir: str
    skill_path: str


AGENTS: list[AgentInfo] = [
    AgentInfo("claude",         "Claude (Claude Code)",         ".claude",     ".claude/skills/glideit-docstring/SKILL.md"),
    AgentInfo("cursor",         "Cursor",                       ".cursor",     ".cursor/skills/glideit-docstring/SKILL.md"),
    AgentInfo("windsurf",       "Windsurf (Codeium)",           ".windsurf",   ".windsurf/skills/glideit-docstring/SKILL.md"),
    AgentInfo("codex",          "OpenAI Codex CLI",             ".codex",      ".codex/skills/glideit-docstring/SKILL.md"),
    AgentInfo("gemini",         "Gemini CLI",                   ".gemini",     ".gemini/skills/glideit-docstring/SKILL.md"),
    AgentInfo("cline",          "Cline",                        ".cline",      ".cline/skills/glideit-docstring/SKILL.md"),
    AgentInfo("opencode",       "OpenCode",                     ".opencode",   ".opencode/skills/glideit-docstring/SKILL.md"),
    AgentInfo("roocode",        "RooCode",                      ".roo",        ".roo/skills/glideit-docstring/SKILL.md"),
    AgentInfo("continue",       "Continue",                     ".continue",   ".continue/skills/glideit-docstring/SKILL.md"),
    AgentInfo("antigravity",    "Antigravity",                  ".agent",      ".agent/skills/glideit-docstring/SKILL.md"),
    AgentInfo("kilocode",       "Kilo Code",                    ".kilocode",   ".kilocode/skills/glideit-docstring/SKILL.md"),
    AgentInfo("github-copilot", "GitHub Copilot",               ".github",     ".github/skills/glideit-docstring/SKILL.md"),
    AgentInfo("amazon-q",       "Amazon Q Developer",           ".amazonq",    ".amazonq/skills/glideit-docstring/SKILL.md"),
    AgentInfo("kiro",           "Kiro (AWS)",                   ".kiro",       ".kiro/skills/glideit-docstring/SKILL.md"),
    AgentInfo("junie",          "JetBrains Junie",              ".junie",      ".junie/skills/glideit-docstring/SKILL.md"),
    AgentInfo("trae",           "Trae",                         ".trae",       ".trae/skills/glideit-docstring/SKILL.md"),
    AgentInfo("forgecode",      "Forge Code",                   ".forge",      ".forge/skills/glideit-docstring/SKILL.md"),
    AgentInfo("auggie",         "Augment Code",                 ".augment",    ".augment/skills/glideit-docstring/SKILL.md"),
    AgentInfo("crush",          "Crush",                        ".crush",      ".crush/skills/glideit-docstring/SKILL.md"),
    AgentInfo("qwen",           "Qwen Coder",                   ".qwen",       ".qwen/skills/glideit-docstring/SKILL.md"),
]


def get_agent(agent_id: str) -> AgentInfo | None:
    for agent in AGENTS:
        if agent.id == agent_id:
            return agent
    return None


def config_dir_exists(repo_root: Path, agent: AgentInfo) -> bool:
    return (repo_root / agent.config_dir).is_dir()


def skill_already_installed(repo_root: Path, agent: AgentInfo) -> bool:
    return (repo_root / agent.skill_path).is_file()
