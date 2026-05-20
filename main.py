import json
import logging
import os
import re
import sys
import threading
import time
import traceback
import uuid
import shutil
import webbrowser
import zipfile
from collections import OrderedDict
from functools import lru_cache
from pathlib import Path

import fitz
import uvicorn
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware

from ai_analyzer import analyze_paper, validate_key
from pdf_parser import document_profile, extract_pdf_text, local_ocr_status
import battle as bt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB

# ── Path resolution: works in dev AND when packaged with PyInstaller ──────────

def _static_dir() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS) / 'static'
    return Path(__file__).parent / 'static'

def _data_dir() -> Path:
    if getattr(sys, 'frozen', False):
        if sys.platform == 'darwin':
            base = Path.home() / 'Library' / 'Application Support' / 'PaperKnowKnow'
        elif sys.platform == 'win32':
            base = Path(os.environ.get('APPDATA', Path.home())) / 'PaperKnowKnow'
        else:
            base = Path.home() / '.paperknowknow'
        base.mkdir(parents=True, exist_ok=True)
        return base
    return Path(__file__).parent

STATIC_DIR  = _static_dir()
DATA_DIR    = _data_dir()
UPLOAD_DIR  = DATA_DIR / 'uploads'
LIBRARY_DIR = DATA_DIR / 'library'
UPLOAD_DIR.mkdir(exist_ok=True)
LIBRARY_DIR.mkdir(exist_ok=True)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="PaperKnowKnow")


# ── Security middleware ──────────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self'; "
            "font-src 'self' data:; "
            "worker-src 'self' blob:; "
        )
        return response

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8000", "http://localhost:8000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ── Simple rate limiter (in-memory) ──────────────────────────────────────────

class _RateLimiter:
    def __init__(self, max_calls: int = 30, window: int = 60):
        self._max = max_calls
        self._window = window
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            stamps = self._hits.get(key, [])
            stamps = [t for t in stamps if now - t < self._window]
            if len(stamps) >= self._max:
                return False
            stamps.append(now)
            self._hits[key] = stamps
            return True

_rate = _RateLimiter(max_calls=30, window=60)


# ── PDF document cache (avoids re-parsing on every request) ──────────────────

class _PDFCache:
    def __init__(self, max_size: int = 8):
        self._cache: OrderedDict[str, fitz.Document] = OrderedDict()
        self._max = max_size
        self._lock = threading.Lock()

    def get(self, path: str) -> fitz.Document:
        with self._lock:
            if path in self._cache:
                self._cache.move_to_end(path)
                return self._cache[path]
            doc = fitz.open(path)
            self._cache[path] = doc
            if len(self._cache) > self._max:
                _, old = self._cache.popitem(last=False)
                old.close()
            return doc

    def evict(self, path: str):
        with self._lock:
            doc = self._cache.pop(path, None)
            if doc:
                doc.close()

_pdf_cache = _PDFCache()


NO_CACHE = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}

# ── Static files ──────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return FileResponse(str(STATIC_DIR / "index.html"), headers=NO_CACHE)

@app.get("/static/style.css")
async def serve_css():
    content = (STATIC_DIR / "style.css").read_bytes()
    return Response(content, media_type="text/css", headers=NO_CACHE)

@app.get("/static/app.js")
async def serve_js():
    content = (STATIC_DIR / "app.js").read_bytes()
    return Response(content, media_type="application/javascript", headers=NO_CACHE)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ── PDF upload / serve ────────────────────────────────────────────────────────

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")
    fid = str(uuid.uuid4())
    dest = UPLOAD_DIR / f"{fid}.pdf"
    size = 0
    with open(dest, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_SIZE:
                f.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, f"File too large (max {MAX_UPLOAD_SIZE // 1024 // 1024} MB)")
            f.write(chunk)
    return {"file_id": fid, "filename": file.filename}


@app.get("/pdf/{file_id}")
async def get_pdf(file_id: str):
    if not all(c.isalnum() or c == "-" for c in file_id):
        raise HTTPException(400, "Invalid file ID")
    path = UPLOAD_DIR / f"{file_id}.pdf"
    if not path.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(str(path), media_type="application/pdf",
                        headers={"Accept-Ranges": "bytes"})


def _resolve_pdf_path(file_id: str, source: str = "upload") -> Path:
    if not all(c.isalnum() or c == "-" for c in file_id):
        raise HTTPException(400, "Invalid file ID")
    path = (LIBRARY_DIR if source == "library" else UPLOAD_DIR) / f"{file_id}.pdf"
    if not path.exists():
        raise HTTPException(404, "File not found")
    return path


@app.get("/document_profile/{file_id}")
async def get_document_profile(file_id: str, source: str = "upload"):
    """Return local readability signals before AI analysis."""
    path = _resolve_pdf_path(file_id, source)
    return document_profile(str(path))


def _normalize_search_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip().lower()


@app.get("/search_doc/{file_id}")
async def search_doc(file_id: str, q: str, source: str = "upload", limit: int = 80):
    """Search the whole document text on the backend.

    Frontend PDF.js search only sees rendered pages. This endpoint searches all
    extracted page text, so Ctrl+F / citation positioning can find pages that
    have not been rendered yet.
    """
    path = _resolve_pdf_path(file_id, source)
    query = _normalize_search_text(q)
    if len(query) < 2:
        return {"matches": []}

    pages = extract_pdf_text(str(path))
    matches = []
    for p in pages:
        raw = p.get("text", "")
        hay = _normalize_search_text(raw)
        pos = hay.find(query)
        if pos < 0:
            words = [w for w in re.split(r"\W+", query) if len(w) >= 4]
            found = [hay.find(w) for w in words if hay.find(w) >= 0]
            pos = min(found) if found else -1
        if pos >= 0:
            start = max(0, pos - 70)
            end = min(len(hay), pos + len(query) + 110)
            matches.append({
                "page": p["page"],
                "snippet": hay[start:end],
                "source": p.get("source", "text_layer"),
            })
            if len(matches) >= limit:
                break
    return {"matches": matches}

# ── Validate API key ──────────────────────────────────────────────────────────

class ValidateReq(BaseModel):
    provider: str
    api_key: str
    model: str = ""


@app.post("/validate")
async def validate(req: ValidateReq):
    if not req.api_key:
        return {"valid": False, "error": "API Key 不能为空"}
    if req.provider not in ("claude", "openai", "gemini"):
        return {"valid": False, "error": "未知服务商"}
    try:
        await validate_key(req.provider, req.api_key, req.model)
        return {"valid": True}
    except Exception as e:
        logger.error("Validate error: %s", traceback.format_exc())
        msg = str(e)
        if "429" in msg or "quota" in msg.lower() or "rate" in msg.lower():
            return {"valid": True, "warning": "Key 有效（当前触发速率限制，稍等片刻再分析）"}
        return {"valid": False, "error": _friendly(msg)}

# ── PDF → Markdown ────────────────────────────────────────────────────────────

@app.get("/pdf_to_md/{file_id}")
async def pdf_to_md(file_id: str, source: str = "upload"):
    """Convert a PDF to Markdown using PyMuPDF text extraction."""
    if not all(c.isalnum() or c == "-" for c in file_id):
        raise HTTPException(400, "Invalid file ID")
    path = (LIBRARY_DIR if source == "library" else UPLOAD_DIR) / f"{file_id}.pdf"
    if not path.exists():
        raise HTTPException(404, "File not found")

    doc = _pdf_cache.get(str(path))
    lines = []
    for i, page in enumerate(doc):
        pw, ph = page.rect.width, page.rect.height
        d = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)

        # Collect all spans with font size info
        page_spans = []
        for block in d.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                line_text = ""
                max_size = 0
                for span in line.get("spans", []):
                    t = span.get("text", "")
                    if t.strip():
                        line_text += t
                        max_size = max(max_size, span.get("size", 0))
                line_text = line_text.strip()
                if line_text:
                    page_spans.append((max_size, line_text))

        if not page_spans:
            lines.append(f"\n## 第 {i+1} 页\n\n*(此页无可提取文字，可能为扫描页)*\n")
            continue

        # Estimate body font size (median)
        sizes = sorted(s for s, _ in page_spans)
        median_size = sizes[len(sizes) // 2] if sizes else 12

        lines.append(f"\n## 第 {i+1} 页\n")
        prev_was_heading = False
        for size, text in page_spans:
            ratio = size / median_size if median_size > 0 else 1
            if ratio >= 1.5:
                lines.append(f"\n### {text}\n")
                prev_was_heading = True
            elif ratio >= 1.2:
                lines.append(f"\n#### {text}\n")
                prev_was_heading = True
            else:
                lines.append(text)
                prev_was_heading = False

    doc.close()
    md_content = "\n".join(lines)
    fname = path.stem + ".md"
    return Response(
        content=md_content.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ── Analyze paper ─────────────────────────────────────────────────────────────

# ── Page text / OCR ───────────────────────────────────────────────────────────

def _extract_page_spans(page, textpage=None) -> list:
    import fitz
    pw, ph = page.rect.width, page.rect.height
    spans = []
    if textpage is None:
        d = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
    else:
        d = page.get_text("dict", textpage=textpage, flags=fitz.TEXT_PRESERVE_WHITESPACE)
    for block in d.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                t = span.get("text", "").strip()
                if not t:
                    continue
                x0, y0, x1, y1 = span["bbox"]
                spans.append({
                    "text": t,
                    "x": round(x0 / pw, 5),
                    "y": round(y0 / ph, 5),
                    "w": round((x1 - x0) / pw, 5),
                    "h": round((y1 - y0) / ph, 5),
                })
    return spans

@app.get("/page_text/{file_id}/{page_num}")
async def page_text(file_id: str, page_num: int, source: str = "upload"):
    """Return text spans for one page (1-based).
    Tries PyMuPDF text extraction first; if empty, returns scanned=True so the
    caller knows it needs AI-OCR (handled by /page_ocr).
    """
    path = _resolve_pdf_path(file_id, source)
    doc = _pdf_cache.get(str(path))
    idx = page_num - 1
    if idx < 0 or idx >= len(doc):
        raise HTTPException(400, "Page out of range")
    page = doc[idx]
    spans = _extract_page_spans(page)
    engine = "text_layer"

    if not spans and local_ocr_status().get("available"):
        try:
            tp = page.get_textpage_ocr(language="eng", dpi=200, full=True)
            ocr_spans = _extract_page_spans(page, tp)
            if ocr_spans:
                spans = ocr_spans
                engine = "local_tesseract"
        except Exception:
            engine = "text_layer"
    doc.close()
    return {
        "spans": spans,
        "scanned": len(spans) == 0,
        "engine": engine,
        "local_ocr": local_ocr_status(),
    }


class OcrReq(BaseModel):
    provider: str
    api_key: str
    model: str = ""


@app.post("/page_ocr/{file_id}/{page_num}")
async def page_ocr(file_id: str, page_num: int, req: OcrReq, source: str = "upload"):
    """Render page as image and OCR it using the AI vision API."""
    if not all(c.isalnum() or c == "-" for c in file_id):
        raise HTTPException(400, "Invalid file ID")
    if req.provider not in ("claude", "openai", "gemini", "deepseek", "groq", "mistral"):
        raise HTTPException(400, "Invalid provider")
    if source == "library":
        path = LIBRARY_DIR / f"{file_id}.pdf"
    else:
        path = UPLOAD_DIR / f"{file_id}.pdf"
    if not path.exists():
        raise HTTPException(404, "File not found")

    import base64, json as _json
    doc = _pdf_cache.get(str(path))
    idx = page_num - 1
    if idx < 0 or idx >= len(doc):
        raise HTTPException(400, "Page out of range")
    page = doc[idx]
    mat = fitz.Matrix(2, 2)   # 2x zoom for better OCR quality
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img_bytes = pix.tobytes("png")
    doc.close()

    b64 = base64.b64encode(img_bytes).decode()
    prompt = (
        "OCR this document page. Return ONLY a JSON array of text spans.\n"
        "Each element: {\"text\": \"content\", \"y\": 0.0}\n"
        "where y is vertical position 0.0 (top) to 1.0 (bottom).\n"
        "Preserve reading order. Return valid JSON only, no explanation."
    )

    try:
        spans = await _ocr_with_ai(req.provider, req.api_key, req.model, b64, prompt)
        return {"spans": spans, "scanned": True}
    except Exception as e:
        logger.error("OCR error: %s", traceback.format_exc())
        raise HTTPException(500, _friendly(str(e)))


async def _ocr_with_ai(provider: str, api_key: str, model: str, img_b64: str, prompt: str):
    import json as _json
    if provider == "claude":
        import anthropic
        m = model or "claude-haiku-4-5-20251001"
        client = anthropic.AsyncAnthropic(api_key=api_key)
        msg = await client.messages.create(
            model=m, max_tokens=4096,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_b64}},
                {"type": "text", "text": prompt},
            ]}],
        )
        raw = msg.content[0].text.strip()
    elif provider == "openai":
        import openai
        m = model or "gpt-4o-mini"
        client = openai.AsyncOpenAI(api_key=api_key)
        r = await client.chat.completions.create(
            model=m, max_tokens=4096,
            messages=[{"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
                {"type": "text", "text": prompt},
            ]}],
        )
        raw = r.choices[0].message.content.strip()
    elif provider == "gemini":
        import google.genai as genai
        from google.genai import types as gtypes
        m = model or "gemini-2.0-flash"
        client = genai.Client(api_key=api_key)
        r = await client.aio.models.generate_content(
            model=m,
            contents=[gtypes.Part.from_bytes(data=__import__('base64').b64decode(img_b64), mime_type="image/png"), prompt],
        )
        raw = r.text.strip()
    else:
        raise ValueError("Unknown provider")

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        raw = raw.rsplit("```", 1)[0].strip()

    items = _json.loads(raw)
    # Normalise: each item must have text and y (0-1)
    result = []
    for item in items:
        if isinstance(item, dict) and item.get("text"):
            result.append({"text": str(item["text"]), "y": float(item.get("y", 0.5))})
    return result


class AnalyzeReq(BaseModel):
    file_id: str = ""
    lib_id: str = ""
    provider: str
    api_key: str
    depth: str
    model: str = ""
    lang: str = "Chinese"
    intent: str = "quick"
    learn_lang: bool = False
    intent_question: str = ""
    max_chars: int = 100000


@app.post("/analyze")
async def analyze(req: AnalyzeReq, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if not _rate.check(client_ip):
        raise HTTPException(429, "Too many requests, please try again later")
    if not req.api_key:
        raise HTTPException(400, "API key required")
    if req.provider not in ("claude", "openai", "gemini", "deepseek", "groq", "mistral"):
        raise HTTPException(400, "Invalid provider")
    if req.file_id:
        if not all(c.isalnum() or c == "-" for c in req.file_id):
            raise HTTPException(400, "Invalid file ID")
        path = UPLOAD_DIR / f"{req.file_id}.pdf"
    elif req.lib_id:
        if not all(c.isalnum() or c == "-" for c in req.lib_id):
            raise HTTPException(400, "Invalid lib ID")
        path = LIBRARY_DIR / f"{req.lib_id}.pdf"
    else:
        raise HTTPException(400, "file_id or lib_id required")
    if not path.exists():
        raise HTTPException(404, "File not found")
    try:
        pages = extract_pdf_text(str(path))
        logger.info("Extracted %d pages from PDF", len(pages))
        total_chars = sum(len(p["text"]) for p in pages)
        logger.info("Total extracted characters: %d", total_chars)
        if total_chars < 200 and local_ocr_status().get("available"):
            logger.info("Text too sparse (%d chars), trying local OCR first", total_chars)
            ocr_pages = extract_pdf_text(str(path), use_local_ocr=True)
            ocr_chars = sum(len(p["text"]) for p in ocr_pages)
            if ocr_chars > total_chars:
                pages = ocr_pages
                total_chars = ocr_chars
                logger.info("Local OCR extracted %d characters", total_chars)
        pdf_path = str(path) if total_chars < 200 else ""
        if pdf_path:
            logger.info("Text too sparse (%d chars), switching to PDF-file mode", total_chars)
        result = await analyze_paper(pages, req.provider, req.api_key, req.depth, req.model, req.lang, req.intent, req.learn_lang, req.intent_question, pdf_path, req.max_chars)
        logger.info("Analysis complete, themes: %d", len(result.get("themes", result.get("sections", []))))
        return result
    except Exception as e:
        logger.error("Analyze error:\n%s", traceback.format_exc())
        raise HTTPException(500, _friendly(str(e)))

# ── Library ───────────────────────────────────────────────────────────────────

class SaveReq(BaseModel):
    file_id: str
    filename: str
    analysis: dict
    tags: list = []


INTENT_TAGS = {
    "快速看懂": "快速看懂",
    "精读导读": "精读导读",
    "精读导航": "精读导读",
    "带问题读": "带问题读",
    "带问题阅读": "带问题读",
    "文献笔记": "文献笔记",
    "审稿视角": "审稿视角",
    "选题推进": "选题推进",
    "研究推进": "选题推进",
    "快速了解": "快速看懂",
    "定向问答": "带问题读",
    "结构化笔记": "文献笔记",
    "批判性分析": "审稿视角",
    "延伸研究": "选题推进",
}


def _clean_tag(tag: str) -> str:
    tag = str(tag or "").strip()
    for prefix in ("分析:", "作者:", "年份:"):
        if tag.startswith(prefix):
            return tag[len(prefix):].strip()
    return tag


def _split_authors(authors: str) -> list[str]:
    if not authors:
        return []
    parts = re.split(r"[;,，、]| and | & ", authors)
    return [p.strip() for p in parts if p.strip()][:6]


def _library_tags(req: SaveReq) -> list[str]:
    tags = []
    for tag in req.tags or []:
        clean_tag = _clean_tag(tag)
        if clean_tag and clean_tag not in tags:
            tags.append(clean_tag)

    meta = req.analysis.get("_meta") or {}
    intent = meta.get("intent") or req.analysis.get("intent") or ""
    if intent:
        tags.append(INTENT_TAGS.get(intent, intent))
    else:
        tags.append("未标注")

    for author in _split_authors(req.analysis.get("authors", "")):
        tags.append(author)

    year = req.analysis.get("year", "")
    if year:
        tags.append(str(year))

    seen = set()
    clean = []
    for tag in tags:
        if tag not in seen:
            clean.append(tag)
            seen.add(tag)
    return clean


def _library_tags_from_data(data: dict) -> list[str]:
    analysis = data.get("analysis") or {}
    pseudo = SaveReq(
        file_id="0",
        filename=data.get("filename", ""),
        analysis=analysis,
        tags=data.get("tags", []),
    )
    return _library_tags(pseudo)


def _analysis_method_from_data(data: dict) -> str:
    analysis = data.get("analysis") or {}
    meta = analysis.get("_meta") or {}
    return meta.get("intent") or analysis.get("intent") or data.get("analysis_method", "") or "未标注"


def _lib_meta_path(lib_id: str) -> Path:
    return LIBRARY_DIR / f"{lib_id}.json"

def _lib_pdf_path(lib_id: str) -> Path:
    return LIBRARY_DIR / f"{lib_id}.pdf"

def _validate_lib_id(lib_id: str):
    if not all(c.isalnum() or c == "-" for c in lib_id):
        raise HTTPException(400, "Invalid library ID")


@app.post("/library/save")
async def library_save(req: SaveReq):
    if not all(c.isalnum() or c == "-" for c in req.file_id):
        raise HTTPException(400, "Invalid file ID")
    src = UPLOAD_DIR / f"{req.file_id}.pdf"
    if not src.exists():
        raise HTTPException(404, "Source PDF not found")

    title = req.analysis.get("title", "")
    lib_id = str(uuid.uuid4())
    shutil.copy(src, _lib_pdf_path(lib_id))
    meta = {
        "id": lib_id,
        "filename": req.filename,
        "title": title,
        "authors": req.analysis.get("authors", ""),
        "year": req.analysis.get("year", ""),
        "analysis_method": (req.analysis.get("_meta") or {}).get("intent", ""),
        "saved_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "tags": _library_tags(req),
        "analysis": req.analysis,
    }
    _lib_meta_path(lib_id).write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"id": lib_id, "updated": False}


@app.get("/library")
async def library_list():
    items = []
    for f in sorted(LIBRARY_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            items.append({k: v for k, v in data.items() if k != "analysis"})
        except Exception:
            pass
    return items


@app.get("/library/export")
async def library_export():
    """Export the whole library folder as a portable zip archive."""
    ts = time.strftime("%Y%m%d-%H%M%S")
    archive = DATA_DIR / f"paperknowknow-library-{ts}.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in LIBRARY_DIR.glob("*"):
            if p.is_file():
                zf.write(p, arcname=f"library/{p.name}")
    return FileResponse(
        str(archive),
        media_type="application/zip",
        filename=archive.name,
    )


@app.post("/library/organize")
async def library_organize():
    """Upgrade old library records with method/author/year tags without touching analysis text."""
    scanned = 0
    changed = 0
    for f in LIBRARY_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            scanned += 1
            before = json.dumps(data, ensure_ascii=False, sort_keys=True)

            analysis = data.get("analysis") or {}
            data["schema_version"] = max(int(data.get("schema_version") or 1), 2)
            data["title"] = data.get("title") or analysis.get("title", "")
            data["authors"] = data.get("authors") or analysis.get("authors", "")
            data["year"] = data.get("year") or analysis.get("year", "")
            data["analysis_method"] = _analysis_method_from_data(data)
            data["tags"] = _library_tags_from_data(data)
            data["organized_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")

            after = json.dumps(data, ensure_ascii=False, sort_keys=True)
            if before != after:
                f.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
                changed += 1
        except Exception:
            logger.warning("Failed to organize library item %s", f, exc_info=True)
    return {"ok": True, "scanned": scanned, "changed": changed}


@app.get("/library/{lib_id}/analysis")
async def library_get_analysis(lib_id: str):
    _validate_lib_id(lib_id)
    p = _lib_meta_path(lib_id)
    if not p.exists():
        raise HTTPException(404, "Not found")
    data = json.loads(p.read_text(encoding="utf-8"))
    return data["analysis"]


@app.get("/library/{lib_id}/pdf")
async def library_get_pdf(lib_id: str):
    _validate_lib_id(lib_id)
    p = _lib_pdf_path(lib_id)
    if not p.exists():
        raise HTTPException(404, "Not found")
    return FileResponse(str(p), media_type="application/pdf", headers={"Accept-Ranges": "bytes"})


class AnnotationReq(BaseModel):
    id: str
    page: int
    text: str
    note: str
    created_at: str = ""


@app.get("/library/{lib_id}/annotations")
async def get_annotations(lib_id: str):
    _validate_lib_id(lib_id)
    p = _lib_meta_path(lib_id)
    if not p.exists():
        raise HTTPException(404, "Not found")
    data = json.loads(p.read_text(encoding="utf-8"))
    return data.get("annotations", [])


@app.post("/library/{lib_id}/annotations")
async def add_annotation(lib_id: str, req: AnnotationReq):
    _validate_lib_id(lib_id)
    p = _lib_meta_path(lib_id)
    if not p.exists():
        raise HTTPException(404, "Not found")
    data = json.loads(p.read_text(encoding="utf-8"))
    annots = data.get("annotations", [])
    annots.append(req.model_dump())
    data["annotations"] = annots
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True}


@app.delete("/library/{lib_id}/annotations/{annot_id}")
async def delete_annotation(lib_id: str, annot_id: str):
    _validate_lib_id(lib_id)
    p = _lib_meta_path(lib_id)
    if not p.exists():
        raise HTTPException(404, "Not found")
    data = json.loads(p.read_text(encoding="utf-8"))
    data["annotations"] = [a for a in data.get("annotations", []) if a.get("id") != annot_id]
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True}


class AnalysisUpdateReq(BaseModel):
    analysis: dict


@app.patch("/library/{lib_id}/analysis")
async def library_update_analysis(lib_id: str, req: AnalysisUpdateReq):
    _validate_lib_id(lib_id)
    p = _lib_meta_path(lib_id)
    if not p.exists():
        raise HTTPException(404, "Not found")
    data = json.loads(p.read_text(encoding="utf-8"))
    data["analysis"] = req.analysis
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True}


class TagsReq(BaseModel):
    tags: list = []


@app.patch("/library/{lib_id}/tags")
async def library_update_tags(lib_id: str, req: TagsReq):
    _validate_lib_id(lib_id)
    p = _lib_meta_path(lib_id)
    if not p.exists():
        raise HTTPException(404, "Not found")
    data = json.loads(p.read_text(encoding="utf-8"))
    data["tags"] = req.tags
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True}


@app.delete("/library/{lib_id}")
async def library_delete(lib_id: str):
    _validate_lib_id(lib_id)
    for ext in [".json", ".pdf"]:
        p = LIBRARY_DIR / f"{lib_id}{ext}"
        if p.exists():
            p.unlink()
    return {"ok": True}


# ── 验证（扩展支持 DeepSeek / Groq / Mistral）─────────────────────────────────

class ValidateExtReq(BaseModel):
    provider: str
    api_key:  str
    model:    str = ""

@app.post("/validate_ext")
async def validate_ext(req: ValidateExtReq):
    """支持所有六个服务商的 Key 验证"""
    if not req.api_key:
        return {"valid": False, "error": "API Key 不能为空"}

    import asyncio
    loop = asyncio.get_event_loop()

    def _do_verify():
        try:
            if req.provider in ("claude", "openai", "gemini"):
                # 复用原有验证逻辑（同步包装）
                import asyncio as _a
                _a.run(validate_key(req.provider, req.api_key, req.model))
                return {"valid": True}

            elif req.provider == "deepseek":
                import openai as _oa
                c = _oa.OpenAI(api_key=req.api_key, base_url="https://api.deepseek.com")
                r = c.chat.completions.create(
                    model=req.model or "deepseek-chat",
                    messages=[{"role": "user", "content": "hi"}], max_tokens=4,
                )
                return {"valid": True, "message": f"验证成功 · {req.model or 'deepseek-chat'}"}

            elif req.provider == "groq":
                import openai as _oa
                c = _oa.OpenAI(api_key=req.api_key, base_url="https://api.groq.com/openai/v1")
                r = c.chat.completions.create(
                    model=req.model or "llama-3.3-70b-versatile",
                    messages=[{"role": "user", "content": "hi"}], max_tokens=4,
                )
                return {"valid": True, "message": f"验证成功 · {req.model or 'llama-3.3-70b-versatile'}"}

            elif req.provider == "mistral":
                import openai as _oa
                c = _oa.OpenAI(api_key=req.api_key, base_url="https://api.mistral.ai/v1")
                r = c.chat.completions.create(
                    model=req.model or "mistral-small-latest",
                    messages=[{"role": "user", "content": "hi"}], max_tokens=4,
                )
                return {"valid": True, "message": f"验证成功 · {req.model or 'mistral-small-latest'}"}

            return {"valid": False, "error": "未知服务商"}
        except Exception as e:
            msg = str(e)
            if "401" in msg or "authentication" in msg.lower() or "invalid" in msg.lower():
                return {"valid": False, "error": "API Key 无效"}
            if "429" in msg or "rate" in msg.lower():
                return {"valid": True, "warning": "Key 有效（当前触发速率限制）"}
            return {"valid": False, "error": _friendly(msg)}

    result = await loop.run_in_executor(None, _do_verify)
    return result


# ── KnowKnow API ──────────────────────────────────────────────────────────────

_battle_sessions: dict = {}
_BATTLE_TTL = 3600  # 1 hour


def _cleanup_expired_sessions():
    now = time.time()
    expired = [k for k, v in _battle_sessions.items() if now - v.get("ts", 0) > _BATTLE_TTL]
    for k in expired:
        del _battle_sessions[k]


class BattleStartReq(BaseModel):
    topic:         str
    provider:      str
    api_key:       str
    model:         str = ""
    mode:          str = "battle"   # "battle" | "chat"
    lang:          str = "Chinese"
    paper_context: dict = {}        # {title, core_question, key_insight, themes:[...]}


@app.post("/battle/start")
async def battle_start(req: BattleStartReq):
    import asyncio, uuid as _uuid
    loop = asyncio.get_event_loop()
    try:
        first_q = await loop.run_in_executor(
            None,
            lambda: bt.attack_first(
                req.topic, req.paper_context,
                req.provider, req.api_key, req.model, req.mode, req.lang,
            ),
        )
    except Exception as e:
        raise HTTPException(500, _friendly(str(e)))

    _cleanup_expired_sessions()
    sid = _uuid.uuid4().hex[:8]
    _battle_sessions[sid] = {
        "ts":      time.time(),
        "topic":   req.topic,
        "context": req.paper_context,
        "provider":req.provider,
        "api_key": req.api_key,
        "model":   req.model,
        "mode":    req.mode,
        "lang":    req.lang,
        "history": [
            {"role": "user",      "content": f"我刚读了论文「{req.topic}」，准备开始这一轮。"},
            {"role": "assistant", "content": first_q},
        ],
    }
    return {"session_id": sid, "question": first_q}


class BattleChatReq(BaseModel):
    session_id: str
    message:    str


@app.post("/battle/chat")
async def battle_chat(req: BattleChatReq):
    import asyncio
    s = _battle_sessions.get(req.session_id)
    if not s:
        raise HTTPException(404, "会话不存在或已过期")

    s["history"].append({"role": "user", "content": req.message})
    loop = asyncio.get_event_loop()
    try:
        reply = await loop.run_in_executor(
            None,
            lambda: bt.attack_reply(
                s["topic"], s["context"], s["history"],
                s["provider"], s["api_key"], s["model"], s.get("mode", "battle"), s.get("lang", "Chinese"),
            ),
        )
    except Exception as e:
        s["history"].pop()
        raise HTTPException(500, _friendly(str(e)))

    s["history"].append({"role": "assistant", "content": reply})
    return {"reply": reply}


class BattleHelpReq(BaseModel):
    session_id: str
    stuck_on:   str


@app.post("/battle/help")
async def battle_help(req: BattleHelpReq):
    import asyncio
    s = _battle_sessions.get(req.session_id)
    if not s:
        raise HTTPException(404, "会话不存在或已过期")

    loop = asyncio.get_event_loop()
    try:
        scaffold = await loop.run_in_executor(
            None,
            lambda: bt.companion_help(
                s["topic"], req.stuck_on,
                s["provider"], s["api_key"], s["model"], s.get("lang", "Chinese"),
            ),
        )
    except Exception as e:
        raise HTTPException(500, _friendly(str(e)))
    return {"scaffold": scaffold}


class BattleEndReq(BaseModel):
    session_id: str


@app.post("/battle/end")
async def battle_end(req: BattleEndReq):
    import asyncio
    s = _battle_sessions.pop(req.session_id, None)
    if not s:
        raise HTTPException(404, "会话不存在或已过期")

    loop = asyncio.get_event_loop()
    summary = await loop.run_in_executor(
        None,
        lambda: bt.summarize(
            s["topic"], s["history"],
            s["provider"], s["api_key"], s["model"], s.get("lang", "Chinese"),
        ),
    )
    return summary


# ── Helpers ───────────────────────────────────────────────────────────────────

def _friendly(msg: str) -> str:
    m = msg.lower()
    if "401" in m or "authentication" in m or ("invalid" in m and "key" in m):
        return "API Key 无效，请在设置中重新检查"
    if "403" in m or "permission" in m:
        return "API Key 无权限访问此模型"
    if "429" in m or "rate" in m or "quota" in m:
        return "请求超出频率限制，请稍后重试"
    if "connect" in m or "timeout" in m or "network" in m:
        return "网络连接失败，请检查网络"
    if "json" in m or "parse" in m:
        return "AI 返回内容解析失败，请重试"
    return msg[:200]

# ── Entry point ───────────────────────────────────────────────────────────────

def _find_free_port(start: int = 8000) -> int:
    import socket
    for port in range(start, start + 10):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind(("127.0.0.1", port))
                return port
        except OSError:
            continue
    return start


def _run_as_app(port: int) -> None:
    """Packaged app mode: show window immediately, start server in background."""
    import tkinter as tk
    import urllib.request

    # ── Build window first so user sees something right away ──────
    root = tk.Tk()
    root.title("PaperKnowKnow")
    root.resizable(False, False)
    root.configure(bg="#F7F6F3")

    w, h = 320, 175
    root.update_idletasks()
    x = (root.winfo_screenwidth() - w) // 2
    y = (root.winfo_screenheight() - h) // 2
    root.geometry(f"{w}x{h}+{x}+{y}")

    f = tk.Frame(root, bg="#F7F6F3", padx=24, pady=16)
    f.pack(fill="both", expand=True)

    tk.Label(f, text="PaperKnowKnow", font=("Helvetica", 15, "bold"),
             bg="#F7F6F3", fg="#37352F").pack()

    status_var = tk.StringVar(value="⏳  启动中，请稍候…")
    status_lbl = tk.Label(f, textvariable=status_var, font=("Helvetica", 10),
                          bg="#F7F6F3", fg="#B45309")
    status_lbl.pack(pady=2)

    url_var = tk.StringVar(value="")
    tk.Label(f, textvariable=url_var, font=("Courier", 9),
             bg="#F7F6F3", fg="#999").pack()

    bf = tk.Frame(f, bg="#F7F6F3")
    bf.pack(pady=10)

    def _open_browser():
        webbrowser.open(f"http://127.0.0.1:{port}/")

    def _quit():
        root.destroy()
        os._exit(0)

    open_btn = tk.Button(bf, text="打开浏览器", command=_open_browser, width=12,
                         relief="flat", bg="#CCCCCC", fg="#888888",
                         padx=8, pady=4, state="disabled")
    open_btn.pack(side="left", padx=4)
    tk.Button(bf, text="退出", command=_quit, width=8,
              relief="flat", bg="#E8E7E3", fg="#37352F",
              padx=8, pady=4, cursor="hand2").pack(side="left", padx=4)

    root.protocol("WM_DELETE_WINDOW", _quit)

    # ── Start server + wait in background, then update UI ─────────
    def _start_and_notify():
        import traceback as _tb

        def _run_server():
            try:
                uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
            except Exception:
                log = Path.home() / "PaperKnowKnow_error.log"
                log.write_text(_tb.format_exc(), encoding="utf-8")

        threading.Thread(target=_run_server, daemon=True).start()

        ready = False
        for _ in range(240):           # up to 60 s (240 × 0.25 s)
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=0.5)
                ready = True
                break
            except Exception:
                time.sleep(0.25)

        def _on_ready():
            status_var.set("✓  服务正在运行")
            status_lbl.config(fg="#0F7B6C")
            url_var.set(f"http://127.0.0.1:{port}")
            open_btn.config(state="normal", bg="#2383E2", fg="white", cursor="hand2")
            webbrowser.open(f"http://127.0.0.1:{port}/")

        def _on_error():
            status_var.set("✗  启动失败，请关闭后重试")
            status_lbl.config(fg="#CB3D3D")

        root.after(0, _on_ready if ready else _on_error)

    threading.Thread(target=_start_and_notify, daemon=True).start()
    root.mainloop()
    os._exit(0)


if __name__ == "__main__":
    port = _find_free_port()
    if getattr(sys, "frozen", False):
        _run_as_app(port)
    else:
        threading.Thread(
            target=lambda: (time.sleep(1.5), webbrowser.open(f"http://127.0.0.1:{port}/")),
            daemon=True,
        ).start()
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
