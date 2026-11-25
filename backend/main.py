"""
AI Exam Grader — FastAPI Backend
Run:  uvicorn main:app --reload --port 8000
"""

import asyncio
import json
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from pipeline import GradingPipeline

# ── app setup ─────────────────────────────────────────────────────────────────

app = FastAPI(title="AI Exam Grader", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JOBS: dict[str, dict] = {}
PIPELINES: dict[str, GradingPipeline] = {}
_executor = ThreadPoolExecutor(max_workers=2)


# ── background worker ─────────────────────────────────────────────────────────

def _run_pipeline(job_id: str, pipeline: GradingPipeline, sheets: list[dict]):
    try:
        JOBS[job_id]["status"] = "running"
        pipeline.run(sheets, JOBS[job_id])
        JOBS[job_id]["status"] = "done"
    except Exception as exc:
        JOBS[job_id]["status"] = "error"
        JOBS[job_id]["error"] = str(exc)
        JOBS[job_id]["progress"].append({"type": "error", "text": f"Fatal: {exc}"})


# ── endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/grade")
async def start_grading(
    groq_api_key: str = Form(default=""),
    subject: str = Form(default="Data Science"),
    question_paper: UploadFile = File(...),
    marking_scheme: UploadFile = File(...),
    answer_sheets: list[UploadFile] = File(...),
):
    """Upload exam files and start grading in the background."""
    q_bytes = await question_paper.read()
    s_bytes = await marking_scheme.read()

    # Decode text if not PDF
    q_text = None
    if not question_paper.filename.lower().endswith(".pdf"):
        q_text = q_bytes.decode("utf-8", errors="ignore")

    s_text = None
    if not marking_scheme.filename.lower().endswith(".pdf"):
        s_text = s_bytes.decode("utf-8", errors="ignore")

    sheets = []
    for sheet in answer_sheets:
        content = await sheet.read()
        name = Path(sheet.filename).stem  # strip extension
        sheets.append({"name": name, "content": content})

    if not sheets:
        return JSONResponse({"error": "No answer sheets uploaded"}, status_code=400)

    job_id = str(uuid.uuid4())[:8]
    JOBS[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "progress": [],
        "results": [],
        "summary": None,
        "error": None,
        "total_students": len(sheets),
        "done_students": 0,
        "pct": 0,
        "current_action": "Queued…",
        "phase": "queued",
    }

    pipeline = GradingPipeline(
        groq_api_key=groq_api_key,
        question_paper_bytes=q_bytes,
        question_paper_text=q_text,
        marking_scheme_bytes=s_bytes,
        marking_scheme_text=s_text,
        subject=subject,
    )

    PIPELINES[job_id] = pipeline
    loop = asyncio.get_event_loop()
    loop.run_in_executor(_executor, _run_pipeline, job_id, pipeline, sheets)

    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}/stream")
async def stream_progress(job_id: str):
    """Server-Sent Events stream for real-time progress updates."""

    async def _generate():
        last_idx = 0
        while True:
            job = JOBS.get(job_id)
            if not job:
                yield f"data: {json.dumps({'type': 'error', 'text': 'Job not found'})}\n\n"
                return

            msgs = job["progress"]
            for msg in msgs[last_idx:]:
                yield f"data: {json.dumps(msg)}\n\n"
            last_idx = len(msgs)

            if job["status"] in ("done", "error"):
                yield f"data: {json.dumps({'type': 'final', 'status': job['status']})}\n\n"
                return

            await asyncio.sleep(0.4)

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    """Full job state including results."""
    job = JOBS.get(job_id)
    if not job:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return job


@app.get("/api/jobs/{job_id}/scheme")
async def get_scheme(job_id: str):
    """Debug: return the parsed marking scheme for this job."""
    pipeline = PIPELINES.get(job_id)
    if pipeline is None:
        return JSONResponse({"error": "Pipeline not found for job"}, status_code=404)
    return {
        "scheme": pipeline._scheme,
        "q_text_preview": pipeline.q_text[:500],
        "scheme_text_preview": pipeline.scheme_text[:500],
    }


@app.get("/api/jobs/{job_id}/csv")
async def download_csv(job_id: str):
    """Download all grades as a CSV file."""
    job = JOBS.get(job_id)
    if not job or not job.get("results"):
        return JSONResponse({"error": "No results yet"}, status_code=404)

    results = job["results"]
    all_qnums = sorted(
        set(qn for r in results for qn in r.get("per_question", {}).keys()),
        key=lambda x: int(x) if x.isdigit() else 0,
    )
    header = ["student_id", "total", "max_marks", "mcq_score", "short_score"] + [
        f"Q{q}" for q in all_qnums
    ]
    rows = [",".join(header)]
    for r in results:
        pq = r.get("per_question", {})
        row = [
            r["student_id"],
            str(r.get("total", 0)),
            str(r.get("max_marks", 0)),
            str(r.get("mcq_score", 0)),
            str(r.get("short_score", 0)),
        ] + [str(pq.get(q, {}).get("awarded", "")) for q in all_qnums]
        rows.append(",".join(row))

    return Response(
        "\n".join(rows),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="grades_{job_id}.csv"'},
    )


@app.get("/api/jobs/{job_id}/reports")
async def download_reports(job_id: str):
    """Download all parent reports as a text file."""
    job = JOBS.get(job_id)
    if not job or not job.get("results"):
        return JSONResponse({"error": "No results yet"}, status_code=404)

    lines = []
    for r in job["results"]:
        lines.append(f"{'='*60}")
        lines.append(f"Student: {r['student_id']}   Score: {r['total']}/{r['max_marks']}")
        lines.append(f"{'='*60}")
        lines.append(r.get("parent_report", "(no report)"))
        lines.append("")

    return Response(
        "\n".join(lines),
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="reports_{job_id}.txt"'},
    )


# ── serve React build (production) ───────────────────────────────────────────

_frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="static")
