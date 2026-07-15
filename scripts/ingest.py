#!/usr/bin/env python3
"""Daily question ingestion for cissp.world.

Reads data/sources.json, fetches each ENABLED source whose license and
provenance have been verified by a human, normalizes candidate questions,
deduplicates them against the existing bank (by id and by normalized
question-text hash), validates them, and appends new ones to
data/questions.json.

Sources that are not explicitly open-licensed are never fetched. This job
deliberately does NOT crawl the open web: "publicly visible" is not
"openly licensed", and cissp.world only ships content it has the right
to redistribute.
"""

import hashlib
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BANK_PATH = ROOT / "data" / "questions.json"
SOURCES_PATH = ROOT / "data" / "sources.json"

REQUIRED_FIELDS = {"question", "options", "answer", "explanation", "domain"}


def normalize_text(text: str) -> str:
    return re.sub(r"\W+", "", text.lower())


def question_fingerprint(q: dict) -> str:
    return hashlib.sha256(normalize_text(q["question"]).encode()).hexdigest()


def validate(q: dict) -> bool:
    if not REQUIRED_FIELDS.issubset(q):
        return False
    if not isinstance(q["options"], list) or len(q["options"]) != 4:
        return False
    if not isinstance(q["answer"], int) or not 0 <= q["answer"] <= 3:
        return False
    if not isinstance(q["domain"], int) or not 1 <= q["domain"] <= 8:
        return False
    if len(q["question"].strip()) < 20 or len(q["explanation"].strip()) < 20:
        return False
    return True


def fetch_github_json(source: dict):
    url = f"https://raw.githubusercontent.com/{source['repo']}/main/{source['path']}"
    req = urllib.request.Request(url, headers={"User-Agent": "cissp-world-ingest"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # missing file or repo is fine — just skip
        print(f"  skip ({exc})")
        return []
    return data.get("questions", data if isinstance(data, list) else [])


def main() -> int:
    bank = json.loads(BANK_PATH.read_text(encoding="utf-8"))
    sources = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))["sources"]

    existing_ids = {q["id"] for q in bank["questions"]}
    existing_fps = {question_fingerprint(q) for q in bank["questions"]}

    added = 0
    for source in sources:
        if not source.get("enabled"):
            continue
        if not (source.get("license_verified") and source.get("provenance_verified")):
            print(f"[{source['id']}] enabled but not fully verified — refusing to ingest")
            continue
        print(f"[{source['id']}] fetching {source['repo']}/{source['path']}")
        for q in fetch_github_json(source):
            if not validate(q):
                continue
            fp = question_fingerprint(q)
            if fp in existing_fps:
                continue
            qid = q.get("id") or f"ext-{fp[:10]}"
            if qid in existing_ids:
                qid = f"ext-{fp[:10]}"
            new_q = {
                "id": qid,
                "domain": q["domain"],
                "difficulty": float(q.get("difficulty", 0.0)),
                "question": q["question"].strip(),
                "options": [str(o).strip() for o in q["options"]],
                "answer": q["answer"],
                "explanation": q["explanation"].strip(),
                "source": source["id"],
                "license": source["license"],
            }
            bank["questions"].append(new_q)
            existing_ids.add(qid)
            existing_fps.add(fp)
            added += 1

    # Full-bank validation acts as the daily health check even with no new items
    invalid = [q["id"] for q in bank["questions"] if not validate(q)]
    if invalid:
        print(f"ERROR: bank contains invalid questions: {invalid}")
        return 1

    if added:
        bank["meta"]["updated"] = date.today().isoformat()
        BANK_PATH.write_text(
            json.dumps(bank, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
    print(f"Done. {added} new question(s); bank size {len(bank['questions'])}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
