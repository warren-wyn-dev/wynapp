#!/usr/bin/env python3
"""Validate repository Markdown without third-party dependencies."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlsplit

MARKDOWN_LINK = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")
EXTERNAL_SCHEMES = {"http", "https", "mailto", "tel"}


@dataclass(frozen=True)
class Finding:
    path: Path
    line: int
    message: str

    def __str__(self) -> str:
        return f"{self.path}:{self.line}: {self.message}"


def markdown_files(root: Path) -> list[Path]:
    """Return Markdown files while excluding Git's internal directory."""
    return sorted(path for path in root.rglob("*.md") if ".git" not in path.parts)


def validate_file(path: Path, root: Path) -> list[Finding]:
    """Return validation findings for one Markdown document."""
    findings: list[Finding] = []
    try:
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        return [Finding(path.relative_to(root), 1, f"cannot read UTF-8 text: {error}")]

    relative_path = path.relative_to(root)
    if not content.strip():
        findings.append(Finding(relative_path, 1, "document is empty"))

    for line_number, line in enumerate(content.splitlines(), start=1):
        if line.rstrip() != line:
            findings.append(Finding(relative_path, line_number, "trailing whitespace"))

        for match in MARKDOWN_LINK.finditer(line):
            destination = match.group(1).strip().strip("<>")
            parsed = urlsplit(destination)
            if parsed.scheme.lower() in EXTERNAL_SCHEMES or not parsed.path:
                continue

            decoded_path = unquote(parsed.path)
            target = (path.parent / decoded_path).resolve()
            try:
                target.relative_to(root.resolve())
            except ValueError:
                findings.append(
                    Finding(relative_path, line_number, f"link leaves repository: {destination}")
                )
                continue

            if not target.exists():
                findings.append(
                    Finding(relative_path, line_number, f"broken relative link: {destination}")
                )

    return findings


def validate_repository(root: Path) -> list[Finding]:
    """Validate every Markdown document below *root*."""
    root = root.resolve()
    return [
        finding
        for path in markdown_files(root)
        for finding in validate_file(path, root)
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", type=Path, default=Path.cwd())
    args = parser.parse_args()

    findings = validate_repository(args.root)
    if findings:
        for finding in findings:
            print(finding, file=sys.stderr)
        print(f"Documentation validation failed with {len(findings)} finding(s).", file=sys.stderr)
        return 1

    count = len(markdown_files(args.root.resolve()))
    print(f"Documentation validation passed for {count} Markdown file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
