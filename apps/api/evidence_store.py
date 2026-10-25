"""Private filesystem proof storage and transactional PostgreSQL evidence repository.

Never mount the vault on a static web server. In production its volume must
support encryption, backups, restricted operator access and retention policies.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException

from .evidence_domain import require_independent_review, require_review_transition


class PrivateEvidenceVault:
    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()
        if "public" in self.root.parts or "dist" in self.root.parts:
            raise ValueError("Evidence vault cannot be located under public/static paths")
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.root, 0o700)

    def put(self, payload: bytes) -> tuple[str, str]:
        key = uuid4().hex
        path = self.root / key
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        fd = os.open(path, flags, 0o600)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(payload)
        except BaseException:
            path.unlink(missing_ok=True)
            raise
        return key, hashlib.sha256(payload).hexdigest()

    def get(self, key: str) -> bytes:
        if len(key) != 32 or any(c not in "0123456789abcdef" for c in key):
            raise HTTPException(404, detail="FILE_NOT_FOUND")
        path = self.root / key
        try:
            return path.read_bytes()
        except FileNotFoundError:
            raise HTTPException(404, detail="FILE_NOT_FOUND")

    def discard(self, key: str) -> None:
        if len(key) == 32 and all(c in "0123456789abcdef" for c in key):
            (self.root / key).unlink(missing_ok=True)


def as_json(row):
    """Only safe metadata, never the vault key, original filename or file body."""
    return {
        "id": str(row["id"]),
        "organization_id": str(row["organization_id"]),
        "category": row["category"],
        "statement": row["statement"],
        "status": row["status"],
        "security_status": row["security_status"],
        "file_mime": row["file_mime"],
        "file_size_bytes": row["file_size_bytes"],
        "created_at": row["created_at"].isoformat(),
        "status_updated_at": row["status_updated_at"].isoformat(),
    }


class PostgresEvidenceRepository:
    """Accept an existing asyncpg pool from the canonical authenticated API."""

    def __init__(self, pool):
        self.pool = pool

    async def submit(self, *, organization_id: str, category: str, statement: str,
                     private_storage_key: str, filename: str, mime: str,
                     file_size: int, sha256: str, actor_id: str) -> dict:
        item_id, audit_id = uuid4(), uuid4()
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    """INSERT INTO hhba_employer_evidence
                       (id, organization_id, category, statement, private_storage_key,
                        original_filename, file_mime, file_size_bytes, sha256, submitted_by)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                       RETURNING *""",
                    item_id, UUID(organization_id), category, statement,
                    private_storage_key, filename[:180], mime, file_size,
                    sha256, UUID(actor_id))
                await conn.execute(
                    """INSERT INTO hhba_evidence_audit
                       (id, evidence_id, actor_id, event_name, after_status)
                       VALUES ($1,$2,$3,'submitted','pending_review')""",
                    audit_id, item_id, UUID(actor_id))
        return as_json(row)

    async def list_by_organization(self, organization_id: str) -> list[dict]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT * FROM hhba_employer_evidence
                   WHERE organization_id=$1 ORDER BY created_at DESC, id DESC LIMIT 200""",
                UUID(organization_id))
        return [as_json(row) for row in rows]

    async def list_pending_review(self) -> list[dict]:
        """Only the authenticated HHBA evidence reviewer may call this query."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT * FROM hhba_employer_evidence
                   WHERE status IN ('pending_review','needs_more_info')
                   ORDER BY created_at ASC, id ASC LIMIT 100""")
        return [as_json(row) for row in rows]

    async def get_private_item(self, item_id: str):
        try:
            item_uuid = UUID(item_id)
        except (ValueError, TypeError):
            raise HTTPException(404, detail="EVIDENCE_NOT_FOUND")
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM hhba_employer_evidence WHERE id=$1", item_uuid)
        if row is None:
            raise HTTPException(404, detail="EVIDENCE_NOT_FOUND")
        return row

    async def review(self, *, item_id: str, decision: str,
                     reason: str, reviewer_id: str) -> dict:
        try:
            item_uuid = UUID(item_id)
        except (ValueError, TypeError):
            raise HTTPException(404, detail="EVIDENCE_NOT_FOUND")
        if len(reason.strip()) < 12 or len(reason.strip()) > 1200:
            raise HTTPException(422, detail="INVALID_REVIEW_REASON")
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    "SELECT * FROM hhba_employer_evidence WHERE id=$1 FOR UPDATE", item_uuid)
                if row is None:
                    raise HTTPException(404, detail="EVIDENCE_NOT_FOUND")
                require_independent_review(str(row["submitted_by"]), reviewer_id)
                require_review_transition(row["status"], decision)
                if decision == "verified" and row["security_status"] != "clean":
                    raise HTTPException(409, detail="FILE_SECURITY_CHECK_REQUIRED")
                updated = await conn.fetchrow(
                    """UPDATE hhba_employer_evidence
                       SET status=$2, status_updated_at=now()
                       WHERE id=$1 RETURNING *""", item_uuid, decision)
                await conn.execute(
                    """INSERT INTO hhba_evidence_reviews
                       (id, evidence_id, reviewer_id, old_status, decision, reason)
                       VALUES ($1,$2,$3,$4,$5,$6)""",
                    uuid4(), item_uuid, UUID(reviewer_id), row["status"], decision,
                    reason.strip())
                await conn.execute(
                    """INSERT INTO hhba_evidence_audit
                       (id, evidence_id, actor_id, event_name, before_status, after_status)
                       VALUES ($1,$2,$3,'reviewed',$4,$5)""",
                    uuid4(), item_uuid, UUID(reviewer_id), row["status"], decision)
        return as_json(updated)
