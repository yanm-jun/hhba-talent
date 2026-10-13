"""Private local parsing worker. It is run outside FastAPI, normally as a Compose service."""
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

from app.main import Audit, ParseJob, Resume, SessionLocal, now

WORKER_ID = os.getenv('HHBA_WORKER_ID', f'worker-{uuid4().hex[:12]}')
UPLOAD_ROOT = Path(os.getenv('HHBA_UPLOAD_ROOT', './private_uploads')).resolve()
MAX_ATTEMPTS = int(os.getenv('HHBA_PARSE_MAX_ATTEMPTS', '3'))
LEASE_SECONDS = int(os.getenv('HHBA_PARSE_LEASE_SECONDS', '180'))
TIMEOUT_SECONDS = int(os.getenv('HHBA_PARSE_TIMEOUT_SECONDS', '120'))


def _safe_result(path: str) -> dict:
    from docling.document_converter import DocumentConverter
    converted = DocumentConverter().convert(path)
    text = converted.document.export_to_markdown()[:200000]
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    skills = [line[2:].strip() for line in lines if line.lower().startswith(('- python', '- java', '- react', '- sql'))][:30]
    return {'raw_text_excerpt': text[:12000], 'display_name': {'value': None, 'status': 'needs_confirmation'}, 'skills': [{'value': v, 'evidence': v, 'status': 'needs_confirmation'} for v in skills], 'experiences': [], 'education': [], 'source': 'docling_local'}


def child_main() -> int:
    # Child receives only a private path. It cannot interpret document macros as code.
    result = _safe_result(sys.argv[2])
    Path(sys.argv[3]).write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    return 0


def recover_stale(session):
    stale = session.scalars(select(ParseJob).where(ParseJob.state == 'processing', ParseJob.lease_expires_at < now()).with_for_update(skip_locked=True)).all()
    for job in stale:
        job.worker_id = None; job.started_at = None; job.lease_expires_at = None; job.updated_at = now()
        if job.attempt_count >= MAX_ATTEMPTS:
            job.state = 'failed'; job.finished_at = now(); job.error_code = 'WORKER_LEASE_EXPIRED'; job.error_safe_message = '本地解析服务中断，重试次数已用尽。'
        else: job.state = 'queued'


def claim_one():
    session = SessionLocal()
    try:
        recover_stale(session)
        job = session.scalar(select(ParseJob).where(ParseJob.state == 'queued', ParseJob.cancel_requested.is_(False)).order_by(ParseJob.created_at).with_for_update(skip_locked=True).limit(1))
        if not job: session.commit(); return None
        resume = session.get(Resume, job.resume_id)
        if not resume:
            job.state = 'cancelled'; job.finished_at = now(); session.commit(); return None
        job.state = 'processing'; job.attempt_count += 1; job.worker_id = WORKER_ID; job.started_at = now(); job.lease_expires_at = now() + timedelta(seconds=LEASE_SECONDS); job.updated_at = now(); resume.status = 'processing'; session.commit()
        return job.id, resume.id, resume.storage_key
    finally: session.close()


def kill_process_tree(process: subprocess.Popen):
    if os.name == 'posix': os.killpg(os.getpgid(process.pid), signal.SIGKILL)
    else: subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True, check=False)


def finish(job_id, state: str, result: dict | None = None, error_code: str | None = None):
    session = SessionLocal()
    try:
        job = session.get(ParseJob, job_id)
        if not job or job.cancel_requested or job.state == 'cancelled': return
        resume = session.get(Resume, job.resume_id)
        job.state = state; job.result_json = result; job.error_code = error_code; job.error_safe_message = None if state == 'parsed' else '本地解析未完成，可在资源检查后受控重试。'; job.finished_at = now(); job.lease_expires_at = None; job.updated_at = now()
        if resume: resume.status = 'parsed' if state == 'parsed' else 'failed'
        session.add(Audit(actor_id=None, action='worker.parse', outcome='success' if state == 'parsed' else 'failed', resource=f'parse_job:{job_id}', request_id=f'worker:{WORKER_ID}', metadata_redacted={'error_type': error_code} if error_code else {})); session.commit()
    finally: session.close()


def process(job_id, storage_key: str):
    input_path = (UPLOAD_ROOT / storage_key).resolve()
    if UPLOAD_ROOT not in input_path.parents or not input_path.is_file(): return finish(job_id, 'failed', error_code='PRIVATE_FILE_MISSING')
    output = Path(tempfile.gettempdir()) / f'{uuid4().hex}.json'
    child = subprocess.Popen([sys.executable, '-m', 'app.docling_worker', '--child', str(input_path), str(output)], start_new_session=(os.name == 'posix'))
    try:
        child.wait(timeout=TIMEOUT_SECONDS)
        if child.returncode != 0 or not output.is_file(): return finish(job_id, 'failed', error_code='LOCAL_PARSE_FAILED')
        return finish(job_id, 'parsed', json.loads(output.read_text(encoding='utf-8')))
    except subprocess.TimeoutExpired:
        kill_process_tree(child); child.wait(timeout=10); return finish(job_id, 'failed', error_code='PARSE_TIMEOUT')
    finally:
        output.unlink(missing_ok=True)


def run_forever():
    while True:
        if not run_once(): time.sleep(1)


def run_once() -> bool:
    claimed = claim_one()
    if not claimed: return False
    process(claimed[0], claimed[2])
    return True


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--child': raise SystemExit(child_main())
    run_forever()
