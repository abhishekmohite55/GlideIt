"""
Health score and security analysis module.

Runs Semgrep static analysis on the scanned repository and produces
a health score, letter grade, and mapped findings for graph-data.json.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SEMGREP_TIMEOUT = 120


class HealthAnalyzer:
    """Runs Semgrep static analysis and computes health score/grade."""

    def analyze(self, repo_root: Path, nodes: list[dict[str, Any]]) -> dict[str, Any] | None:
        """
        Run Semgrep, parse findings, map to node IDs, compute score/grade.

        Returns a dict with keys: score, grade, semgrep_version, analyzed_at,
        findings, summary.  Returns None on any failure (Semgrep not installed,
        parse error, exception).
        """
        try:
            semgrep_path = shutil.which("semgrep")
            if semgrep_path is None:
                logger.info("Semgrep not found — skipping health analysis")
                return None

            version = self._capture_version(semgrep_path)
            raw_output = self._run_semgrep(semgrep_path, repo_root)
            if raw_output is None:
                return None

            findings = self._parse_findings(raw_output, repo_root, nodes)
            score, grade = self._compute_score_and_grade(findings)

            return {
                "score": score,
                "grade": grade,
                "semgrep_version": version,
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
                "findings": findings,
                "summary": self._build_summary(findings),
            }
        except Exception as exc:
            logger.warning("Health analysis failed: %s", exc)
            return None

    @staticmethod
    def _capture_version(semgrep_path: str) -> str:
        result = subprocess.run(
            [semgrep_path, "--version"],
            capture_output=True, text=True, timeout=30,
        )
        return result.stdout.strip()

    @staticmethod
    def _run_semgrep(semgrep_path: str, repo_root: Path) -> str | None:
        cmd = [
            semgrep_path,
            "--config", "p/python",
            "--config", "p/javascript",
            "--config", "p/security-audit",
            "--json",
            "--quiet",
            str(repo_root),
        ]
        try:
            result = subprocess.run(
                cmd,
                capture_output=True, text=True, timeout=SEMGREP_TIMEOUT,
            )
        except subprocess.TimeoutExpired:
            logger.warning("Semgrep timed out after %ds", SEMGREP_TIMEOUT)
            return None

        if result.returncode not in (0, 1):
            logger.warning("Semgrep exited with code %d", result.returncode)

        if not result.stdout:
            logger.warning("Semgrep produced no output")
            return None

        return result.stdout

    @staticmethod
    def _parse_findings(
        raw_output: str,
        repo_root: Path,
        nodes: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        try:
            data = json.loads(raw_output)
        except json.JSONDecodeError:
            logger.warning("Failed to parse Semgrep JSON output")
            return []

        results = data.get("results", [])
        if not results:
            return []

        file_to_nodes: dict[str, list[dict[str, Any]]] = {}
        for node in nodes:
            nf = node.get("file", "")
            file_to_nodes.setdefault(nf, []).append(node)
        for nf in file_to_nodes:
            file_to_nodes[nf].sort(key=lambda n: n.get("line", 0))

        findings: list[dict[str, Any]] = []
        for r in results:
            try:
                rel_path = Path(r["path"]).relative_to(repo_root).as_posix()
            except ValueError:
                continue

            finding_line = r.get("start", {}).get("line", 0)
            node_id: str | None = None
            candidates = file_to_nodes.get(rel_path, [])
            for cn in candidates:
                cn_line = cn.get("line", 0)
                if cn_line <= finding_line:
                    node_id = cn["id"]
                else:
                    break

            findings.append({
                "rule_id": r.get("check_id", "unknown"),
                "severity": r.get("extra", {}).get("severity", "INFO"),
                "message": r.get("extra", {}).get("message", ""),
                "file": rel_path,
                "line": finding_line,
                "node_id": node_id,
            })

        return findings

    @staticmethod
    def _compute_score_and_grade(
        findings: list[dict[str, Any]],
    ) -> tuple[int, str]:
        """
        Score formula:
        score = 100 - (ERROR_count x 15) - (WARNING_count x 5) - (INFO_count x 1)
        score = max(0, min(100, score))
        """
        counts = {"ERROR": 0, "WARNING": 0, "INFO": 0}
        for f in findings:
            sev = f.get("severity", "INFO")
            if sev in counts:
                counts[sev] += 1

        score = 100 - (counts["ERROR"] * 15) - (counts["WARNING"] * 5) - (counts["INFO"] * 1)
        score = max(0, min(100, score))

        if score >= 90:
            grade = "A"
        elif score >= 75:
            grade = "B"
        elif score >= 60:
            grade = "C"
        elif score >= 40:
            grade = "D"
        else:
            grade = "F"

        return int(score), grade

    @staticmethod
    def _build_summary(findings: list[dict[str, Any]]) -> dict[str, int]:
        summary: dict[str, int] = {}
        for f in findings:
            sev = f.get("severity", "INFO")
            summary[sev] = summary.get(sev, 0) + 1
        return summary
