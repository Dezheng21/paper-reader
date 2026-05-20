import fitz  # PyMuPDF
from typing import List, Dict, Optional


def local_ocr_status(tessdata: Optional[str] = None) -> Dict:
    """Return whether PyMuPDF can use local Tesseract OCR on this machine."""
    try:
        resolved = fitz.get_tessdata(tessdata)
        return {
            "available": True,
            "engine": "tesseract",
            "tessdata": resolved,
            "note": "本地 Tesseract OCR 可用",
        }
    except Exception as e:
        return {
            "available": False,
            "engine": "tesseract",
            "tessdata": "",
            "note": str(e),
        }


def _clean_text(text: str) -> str:
    return "\n".join(line for line in text.splitlines() if line.strip())


def extract_pdf_text(
    pdf_path: str,
    use_local_ocr: bool = False,
    ocr_language: str = "eng",
    min_page_chars: int = 20,
) -> List[Dict]:
    """Extract text from each page, returning [{page, text}]."""
    doc = fitz.open(pdf_path)
    pages = []
    ocr_available = local_ocr_status().get("available", False) if use_local_ocr else False
    for i in range(len(doc)):
        page = doc[i]
        text = _clean_text(page.get_text("text"))
        source = "text_layer"
        if ocr_available and len(text) < min_page_chars:
            try:
                tp = page.get_textpage_ocr(language=ocr_language, dpi=200, full=True)
                ocr_text = _clean_text(page.get_text("text", textpage=tp))
                if len(ocr_text) > len(text):
                    text = ocr_text
                    source = "local_ocr"
            except Exception:
                source = "text_layer"
        pages.append({"page": i + 1, "text": text, "source": source})
    doc.close()
    return pages


def document_profile(pdf_path: str) -> Dict:
    """Inspect a PDF before analysis so the UI can show reliability signals."""
    doc = fitz.open(pdf_path)
    pages = []
    total_chars = 0
    scanned_pages = 0
    image_pages = 0
    image_count = 0

    for i in range(len(doc)):
        page = doc[i]
        text = _clean_text(page.get_text("text"))
        chars = len(text)
        images = len(page.get_images(full=True))
        total_chars += chars
        image_count += images
        if chars < 20:
            scanned_pages += 1
        if images:
            image_pages += 1
        pages.append({
            "page": i + 1,
            "text_chars": chars,
            "has_text_layer": chars >= 20,
            "image_count": images,
            "likely_scanned": chars < 20 and images > 0,
        })

    page_count = len(doc)
    doc.close()
    text_pages = page_count - scanned_pages
    text_coverage = round(text_pages / page_count, 3) if page_count else 0

    if text_coverage >= 0.8:
        reliability = "high"
        recommendation = "文字层较完整，适合文本分析。图表结论仍需人工抽查。"
    elif text_coverage >= 0.3:
        reliability = "medium"
        recommendation = "文字层不完整，建议先 OCR 缺失页面，再分析。"
    else:
        reliability = "low"
        recommendation = "疑似扫描版，纯文本分析不可靠；优先使用本地 OCR 或多模态模型。"

    return {
        "page_count": page_count,
        "text_chars": total_chars,
        "text_pages": text_pages,
        "scanned_pages": scanned_pages,
        "image_pages": image_pages,
        "image_count": image_count,
        "text_coverage": text_coverage,
        "reliability": reliability,
        "recommendation": recommendation,
        "local_ocr": local_ocr_status(),
        "pages": pages,
    }
