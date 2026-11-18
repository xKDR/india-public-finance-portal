#!/usr/bin/env python3
"""
Copy a built state package into state-finances/<package>/ and rebuild its
validation summary. stdlib Python only. Re-runnable: the target folder is
replaced on every run, so the result depends only on the input package.

Usage (from any directory):
    python3 tools/import_state_package.py --package bihar --from <built package dir>

The input is the folder a state's package builder writes, for example
<work>/package/state-finances/bihar. The input is never changed.

Rules applied on copy:
  * Source PDFs (<PREFIX>_pdfs/ and *.pdf) are left out. PDF shipping is a
    separate decision; see the top-level README.
  * <PREFIX>_checks_<Y>.ndjson is gzip-compressed to .ndjson.gz, the same file
    kind Tamil Nadu compresses (deterministic gzip, mtime 0). Mentions of the
    plain name in the package's .md and .csv documents get the .gz suffix.
  * A file over GitHub's 100 MB limit stops the import.
Then tools/build_validation_summary.py --package <package> runs.
"""

import argparse
import gzip
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(REPO_ROOT / "tools"))
import build_validation_summary as bvs  # noqa: E402

GITHUB_LIMIT = 100 * 1024 * 1024
GITHUB_WARN = 50 * 1024 * 1024
SKIP_NAMES = {".DS_Store", "__pycache__"}


def gzip_file(src: Path, dst: Path) -> None:
    with open(src, "rb") as fin, open(dst, "wb") as raw, \
            gzip.GzipFile(fileobj=raw, mode="wb", mtime=0, filename="") as gz:
        shutil.copyfileobj(fin, gz, 1 << 20)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--package", required=True, choices=sorted(bvs.PACKAGES))
    ap.add_argument("--from", dest="src", required=True, type=Path)
    args = ap.parse_args()

    prefix = bvs.PACKAGES[args.package]["state"]
    src = args.src.resolve()
    if not (src / f"{prefix}_README.md").is_file() or not (src / f"{prefix}_years").is_dir():
        raise SystemExit(f"ERROR: {src} is not a {prefix} package "
                         f"(needs {prefix}_README.md and {prefix}_years/)")
    dst = REPO_ROOT / "state-finances" / args.package
    if dst.exists():
        shutil.rmtree(dst)

    checks_ndjson = re.compile(rf"^{prefix}_checks_\d{{4}}-\d{{2}}\.ndjson$")
    n_pdf = gzipped = 0
    for path in sorted(src.rglob("*")):
        rel = path.relative_to(src)
        if any(part in SKIP_NAMES for part in rel.parts):
            continue
        if any(part == f"{prefix}_pdfs" for part in rel.parts) or path.suffix.lower() == ".pdf":
            n_pdf += path.is_file()
            continue
        out = dst / rel
        if path.is_dir():
            out.mkdir(parents=True, exist_ok=True)
        elif checks_ndjson.match(path.name):
            out.parent.mkdir(parents=True, exist_ok=True)
            gzip_file(path, out.with_name(path.name + ".gz"))
            gzipped += 1
        else:
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, out)

    if gzipped:
        mention = re.compile(rf"({prefix}_checks_[^\s`,|)]*\.ndjson)(?!\.gz)")
        for doc in sorted(list(dst.glob("*.md")) + list(dst.glob("*.csv"))):
            text = doc.read_text(encoding="utf-8")
            new = mention.sub(r"\1.gz", text)
            if new != text:
                doc.write_text(new, encoding="utf-8")
                print(f"  doc: {doc.name}: checks NDJSON named as .ndjson.gz")

    print(f"Imported {src} -> {dst}")
    print(f"  left out {n_pdf} PDF file(s); gzipped {gzipped} checks NDJSON file(s)")

    subprocess.run([sys.executable, str(REPO_ROOT / "tools" / "build_validation_summary.py"),
                    "--package", args.package], check=True)

    total = 0
    big = []
    for f in sorted(dst.rglob("*")):
        if f.is_file():
            size = f.stat().st_size
            total += size
            if size > GITHUB_WARN:
                big.append((size, f.relative_to(REPO_ROOT)))
    for size, rel in big:
        print(f"  {'OVER 100 MB' if size > GITHUB_LIMIT else 'over 50 MB'}: "
              f"{size / 1048576:.1f} MB {rel}")
    print(f"  package size {total / 1048576:.1f} MB")
    if any(size > GITHUB_LIMIT for size, _ in big):
        raise SystemExit("ERROR: a file is over GitHub's 100 MB limit")


if __name__ == "__main__":
    main()
