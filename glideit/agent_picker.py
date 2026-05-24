from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

from glideit.agent_registry import AGENTS, AgentInfo, skill_already_installed


@dataclass
class PickerState:
    agents: list[AgentInfo]
    selected: set[str] = field(default_factory=set)
    cursor: int = 0


def _getch() -> str:
    if sys.platform == "win32":
        import msvcrt
        ch = msvcrt.getwch()
        if ch == "\x00" or ch == "\xe0":
            ch2 = msvcrt.getwch()
            if ch2 == "H":
                return "\x1b[A"
            elif ch2 == "P":
                return "\x1b[B"
        return ch
    else:
        import termios
        import tty
        fd = sys.stdin.fileno()
        old = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            ch = sys.stdin.read(1)
            if ch == "\x1b":
                ch2 = sys.stdin.read(1)
                ch3 = sys.stdin.read(1)
                return f"{ch}{ch2}{ch3}"
            return ch
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old)


def _clear_lines(n: int) -> None:
    for _ in range(n):
        sys.stdout.write("\x1b[1A\x1b[2K")
    sys.stdout.flush()


def _render(state: PickerState, repo_root: Path, update_mode: bool) -> int:
    lines = []
    lines.append("")

    if update_mode:
        lines.append("  \033[96mGlideIt Init --update\033[0m  — select agents to update skill:")
    else:
        lines.append("  \033[96mGlideIt Init\033[0m  — select which agents to set up:")

    lines.append("  Use ↑↓ to move, SPACE to toggle, A to select all, ENTER to confirm, Q to quit.")
    lines.append("")

    for i, agent in enumerate(state.agents):
        checked = "\u2713" if agent.id in state.selected else " "
        cursor_indicator = "\u25b6" if i == state.cursor else " "
        installed_tag = ""
        if skill_already_installed(repo_root, agent):
            installed_tag = "  \033[92m[installed]\033[0m"
        elif (repo_root / agent.config_dir).is_dir():
            installed_tag = "  \033[93m[config dir exists]\033[0m"

        color_start = "\033[1m" if i == state.cursor else ""
        color_end = "\033[0m" if i == state.cursor else ""
        lines.append(f"  {cursor_indicator} [{checked}] {color_start}{agent.display_name}{color_end}{installed_tag}")

    lines.append("")
    lines.append(f"  Selected: {len(state.selected)} agent(s)   Press ENTER to confirm.")
    lines.append("")

    for line in lines:
        print(line)

    return len(lines)


def run_picker(repo_root: Path, update_mode: bool = False) -> list[str] | None:
    if update_mode:
        visible_agents = [a for a in AGENTS if skill_already_installed(repo_root, a)]
        if not visible_agents:
            return []
    else:
        visible_agents = list(AGENTS)

    state = PickerState(agents=visible_agents)
    lines_printed = 0

    while True:
        if lines_printed > 0:
            _clear_lines(lines_printed)
        lines_printed = _render(state, repo_root, update_mode)

        try:
            key = _getch()
        except Exception:
            break

        if key in ("q", "Q", "\x03"):
            _clear_lines(lines_printed)
            return None

        elif key in ("\r", "\n"):
            break

        elif key in ("\x1b[A", "k", "K"):
            state.cursor = (state.cursor - 1) % len(state.agents)

        elif key in ("\x1b[B", "j", "J"):
            state.cursor = (state.cursor + 1) % len(state.agents)

        elif key == " ":
            agent_id = state.agents[state.cursor].id
            if agent_id in state.selected:
                state.selected.discard(agent_id)
            else:
                state.selected.add(agent_id)

        elif key in ("a", "A"):
            if len(state.selected) == len(state.agents):
                state.selected.clear()
            else:
                state.selected = {a.id for a in state.agents}

    _clear_lines(lines_printed)
    return list(state.selected)
