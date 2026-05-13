#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import subprocess
import shutil
import os
import tarfile
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional


@dataclass(frozen=True)
class BranchSnapshot:
    name: str
    commit: str
    output_dir: str


def _run_git(args: list[str], *, cwd: Path) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=str(cwd),
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip()


def _list_remote_branches(*, cwd: Path, remote: str) -> list[str]:
    refs = _run_git(
        ["for-each-ref", f"refs/remotes/{remote}", "--format=%(refname:short)"],
        cwd=cwd,
    ).splitlines()
    return [
        ref.strip()
        for ref in refs
        if ref.strip()
        and ref.strip() != f"{remote}/HEAD"
        and not ref.strip().endswith("/HEAD")
    ]


def _safe_name(branch_ref: str, *, remote: str) -> str:
    prefix = f"{remote}/"
    if branch_ref.startswith(prefix):
        branch_ref = branch_ref[len(prefix) :]
    return branch_ref.replace("/", "__")


def _is_within_directory(base_dir: Path, candidate: Path) -> bool:
    try:
        candidate.resolve().relative_to(base_dir.resolve())
        return True
    except ValueError:
        return False


def _safe_extract(tar: tarfile.TarFile, *, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    for member in tar:
        name = member.name
        if not name or name.startswith("/") or name.startswith("\\"):
            raise ValueError(f"Unsafe tar member path: {name!r}")

        member_path = dest / name
        if not _is_within_directory(dest, member_path):
            raise ValueError(f"Tar member escapes destination: {name!r}")

        if member.issym() or member.islnk():
            raise ValueError(f"Refusing to extract symlink/hardlink: {name!r}")

        if member.isdir():
            member_path.mkdir(parents=True, exist_ok=True)
            continue

        if member.isfile():
            member_path.parent.mkdir(parents=True, exist_ok=True)
            extracted = tar.extractfile(member)
            if extracted is None:
                raise ValueError(f"Unable to extract file payload: {name!r}")
            with extracted:
                with open(member_path, "wb") as out:
                    shutil.copyfileobj(extracted, out)
            try:
                os.chmod(member_path, member.mode)
            except OSError:
                pass
            continue

        raise ValueError(f"Unsupported tar member type for {name!r}")


def _archive_branch(*, cwd: Path, branch_ref: str, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen(
        ["git", "archive", "--format=tar", branch_ref],
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert proc.stdout is not None
    assert proc.stderr is not None

    try:
        with tarfile.open(fileobj=proc.stdout, mode="r|") as tar:
            _safe_extract(tar, dest=dest)
    finally:
        proc.stdout.close()
        stderr = proc.stderr.read().decode("utf-8", errors="replace")
        proc.stderr.close()
        rc = proc.wait()
        if rc != 0:
            raise RuntimeError(f"git archive failed for {branch_ref} (rc={rc}): {stderr.strip()}")


def consolidate(
    *,
    repo_root: Path,
    output_root: Path,
    remote: str,
    include: Optional[set[str]] = None,
    exclude: Optional[set[str]] = None,
) -> list[BranchSnapshot]:
    branches = _list_remote_branches(cwd=repo_root, remote=remote)
    selected: list[str] = []
    for ref in branches:
        short = ref[len(f"{remote}/") :] if ref.startswith(f"{remote}/") else ref
        if include and short not in include and ref not in include:
            continue
        if exclude and (short in exclude or ref in exclude):
            continue
        selected.append(ref)

    output_root.mkdir(parents=True, exist_ok=True)
    snapshots: list[BranchSnapshot] = []

    for ref in sorted(selected):
        safe = _safe_name(ref, remote=remote)
        commit = _run_git(["rev-parse", ref], cwd=repo_root)
        branch_out = output_root / safe

        if branch_out.exists():
            raise FileExistsError(f"Refusing to overwrite existing directory: {branch_out}")

        _archive_branch(cwd=repo_root, branch_ref=ref, dest=branch_out)
        snapshots.append(BranchSnapshot(name=ref, commit=commit, output_dir=str(branch_out)))

    return snapshots


def _parse_set(items: Optional[Iterable[str]]) -> Optional[set[str]]:
    if not items:
        return None
    expanded: set[str] = set()
    for value in items:
        if not value:
            continue
        expanded.update(part.strip() for part in value.split(",") if part.strip())
    return expanded or None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Snapshot every remote branch into a single consolidated folder using `git archive`."
    )
    parser.add_argument(
        "--output",
        default="consolidated/branches",
        help="Output root directory for per-branch snapshots (default: consolidated/branches).",
    )
    parser.add_argument(
        "--remote",
        default="origin",
        help="Git remote name to enumerate branches from (default: origin).",
    )
    parser.add_argument(
        "--include",
        action="append",
        help="Branch names to include (repeatable, comma-separated). Matches either 'branch' or 'origin/branch'.",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        help="Branch names to exclude (repeatable, comma-separated). Matches either 'branch' or 'origin/branch'.",
    )
    args = parser.parse_args()

    repo_root = Path(_run_git(["rev-parse", "--show-toplevel"], cwd=Path.cwd()))
    output_root = (repo_root / args.output).resolve()
    include = _parse_set(args.include)
    exclude = _parse_set(args.exclude)

    started_at = datetime.now(timezone.utc).isoformat()

    snapshots = consolidate(
        repo_root=repo_root,
        output_root=output_root,
        remote=args.remote,
        include=include,
        exclude=exclude,
    )

    manifest = {
        "schema": 1,
        "startedAt": started_at,
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "repoRoot": str(repo_root),
        "remote": args.remote,
        "outputRoot": str(output_root),
        "snapshots": [asdict(snapshot) for snapshot in snapshots],
    }

    manifest_path = output_root.parent / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    print(f"Wrote {len(snapshots)} branch snapshots to {output_root}")
    print(f"Wrote manifest to {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
