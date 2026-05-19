import fitz  # PyMuPDF
from typing import List, Dict


def extract_pdf_text(pdf_path: str) -> List[Dict]:
    """Extract text from each page, returning [{page, text}]."""
    doc = fitz.open(pdf_path)
    pages = []
    for i in range(len(doc)):
        page = doc[i]
        text = page.get_text("text")
        # Remove blank lines to reduce token count
        text = "\n".join(line for line in text.splitlines() if line.strip())
        pages.append({"page": i + 1, "text": text})
    doc.close()
    return pages
