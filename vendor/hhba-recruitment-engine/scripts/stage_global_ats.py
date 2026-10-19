"""Read-only staged ATS probe; never mutate jobs_master.jsonl or publish JD.
python scripts/stage_global_ats.py --registry boards.json --output-dir /outside/repo/run --execute-network
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from hhba_pipeline.global_ats import Board, collect_board


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--registry", type=Path, required=True)
    p.add_argument("--output-dir", type=Path, required=True)
    p.add_argument("--execute-network", action="store_true")
    p.add_argument("--max-boards", type=int, default=3)
    p.add_argument("--pause-seconds", type=float, default=2.0)
    args = p.parse_args()
    if not args.execute_network:
        p.error("explicit --execute-network is required")
    if not 1 <= args.max_boards <= 10 or args.pause_seconds < 1.0:
        p.error("pilot is limited to 1-10 boards with >=1s pause")
    output = args.output_dir.resolve()
    if output == ROOT or output.is_relative_to(ROOT):
        p.error("staging must be outside Git repository")
    data = json.loads(args.registry.read_text(encoding="utf-8"))
    items = data.get("boards")
    if not isinstance(items, list) or len(items) > args.max_boards:
        p.error("registry must contain <= --max-boards reviewed boards")
    boards = [Board.from_dict(item) for item in items]
    if len({board.source_id for board in boards}) != len(boards):
        p.error("duplicate ATS source ID")
    output.mkdir(parents=True, exist_ok=True)
    for i, board in enumerate(boards):
        if i:
            time.sleep(args.pause_seconds)
        try:
            jobs, report = collect_board(board)
            data = "".join(json.dumps(job, ensure_ascii=False, sort_keys=True) + "\n" for job in jobs).encode("utf-8")
            target = output / f"{board.source_id}.jsonl"
            if target.exists():
                raise ValueError("staging output already exists: refuse overwrite")
            target.write_bytes(data)
            report["sha256"] = hashlib.sha256(data).hexdigest()
            report["source_evidence_url"] = board.evidence_url
            (output / f"{board.source_id}.manifest.json").write_text(
                json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(json.dumps({"source_id": board.source_id, "indexed_rows": len(jobs), "status": "STAGED_ONLY"}))
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            print(json.dumps({"source_id": board.source_id, "status": "BLOCKED", "reason": str(exc)}), file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
