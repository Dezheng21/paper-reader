/* PaperKnowKnow - PDF viewer module.
 * Renders PDF pages via PDF.js, handles search, navigation,
 * file upload, and PDF -> Markdown export.
 * Function declarations only - no top-level executable code.
 * Reads shared globals from window (set by app.js):
 *   pdfDoc, fileId, currentFilename, pdfjsLib, CMAP_URL, CMAP_PACKED,
 *   renderObs, _renderGen, _searchMatches, _searchIdx, _searchTerm, _searchSeq
 */

function openPdfSearch() {
  pdfSearchBar.classList.add('show');
  pdfSearchInput.focus();
  pdfSearchInput.select();
  // Show OCR button if any already-rendered pages are flagged as scanned
  const hasScanned = pdfPages.querySelector('.textLayer[data-scanned]');
  pdfSearchOcr.style.display = hasScanned ? '' : 'none';
}

function closePdfSearch() {
  pdfSearchBar.classList.remove('show');
  clearSearchHighlights();
  _searchMatches = [];
  _searchIdx = -1;
  _searchTerm = '';
  pdfSearchCount.textContent = '';
}

function clearSearchHighlights() {
  pdfPages.querySelectorAll('.hl-search, .hl').forEach(el => {
    el.classList.remove('hl-search', 'current', 'hl');
  });
}

function normalizeFindText(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function spanRangesForQuery(spans, query) {
  const candidates = [];
  const qNorm = normalizeFindText(query);
  if (qNorm.length >= 2) candidates.push(qNorm);

  String(query || '')
    .split(/[\s,.;:，。；：、()[\]{}"'“”‘’!?！？-]+/)
    .map(normalizeFindText)
    .filter(w => w.length >= 3)
    .slice(0, 8)
    .forEach(w => candidates.push(w));

  let full = '';
  const ranges = [];
  for (const span of spans) {
    const start = full.length;
    const norm = normalizeFindText(span.textContent);
    full += norm;
    ranges.push({ span, start, end: full.length });
  }

  for (const needle of candidates) {
    const pos = full.indexOf(needle);
    if (pos >= 0) {
      const end = pos + needle.length;
      const hit = ranges
        .filter(r => r.end > pos && r.start < end)
        .map(r => r.span);
      if (hit.length) return hit;
    }
  }
  return [];
}

function highlightSpanGroup(spans, cls = 'hl-search') {
  spans.forEach(s => s.classList.add(cls));
  return spans[0] || null;
}

async function executeSearch(term) {
  const seq = ++_searchSeq;
  clearSearchHighlights();
  _searchMatches = [];
  _searchIdx = -1;
  _searchTerm = term;
  if (!term || !pdfDoc) { pdfSearchCount.textContent = ''; return; }

  const layers = pdfPages.querySelectorAll('.textLayer');
  layers.forEach(layer => {
    const spans = Array.from(layer.querySelectorAll('span'));
    const hits = spanRangesForQuery(spans, term);
    if (hits.length) {
      highlightSpanGroup(hits, 'hl-search');
      _searchMatches.push({ pageNum: parseInt(layer.dataset.page) || 1, el: hits[0], els: hits, query: term });
    }
  });

  if (_searchMatches.length === 0) {
    pdfSearchCount.textContent = ui().misc.searchLoading;
    const backendMatches = await searchDocumentBackend(term);
    if (seq !== _searchSeq) return;
    _searchMatches = backendMatches.map(m => ({
      pageNum: m.page,
      el: null,
      snippet: m.snippet || '',
      query: term,
      fallbackQuery: m.snippet || '',
    }));
  }

  if (_searchMatches.length === 0) {
    pdfSearchCount.textContent = t('search_no_result');
    return;
  }
  _searchIdx = 0;
  navigateSearchMatch();
}

async function searchDocumentBackend(term) {
  const id = currentLibId || fileId;
  if (!id) return [];
  const source = currentLibId ? 'library' : 'upload';
  try {
    const r = await fetch(`/search_doc/${id}?source=${source}&q=${encodeURIComponent(term)}`);
    if (!r.ok) return [];
    const data = await r.json();
    return data.matches || [];
  } catch (_) {
    return [];
  }
}

async function navigateSearchMatch() {
  if (!_searchMatches.length) return;
  _searchMatches.forEach(m => (m.els || [m.el]).forEach(el => el?.classList.remove('current')));
  const match = _searchMatches[_searchIdx];
  pdfSearchCount.textContent = t('search_count', { a: _searchIdx + 1, b: _searchMatches.length });
  pdfSearchPrev.disabled = _searchIdx <= 0;
  pdfSearchNext.disabled = _searchIdx >= _searchMatches.length - 1;
  if (match.el) {
    (match.els || [match.el]).forEach(el => el?.classList.add('current'));
    match.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else {
    const ok = await goToPage(match.pageNum, match.query || _searchTerm);
    if (!ok && match.fallbackQuery) await goToPage(match.pageNum, match.fallbackQuery);
  }
}

async function searchCitationInPDF(text) {
  if (!text) return;
  if (!pdfDoc) { toast(t('toast_need_pdf')); return; }
  const snapDoc = pdfDoc;
  showLoading(ui().misc.searchOriginal);
  // Try progressively shorter prefixes for robustness across PDF text extraction
  const candidates = [
    text.slice(0, 40),
    text.slice(0, 25),
    text.split(/[\s,.;:]/)[0],  // first word/phrase
  ].map(s => s.trim().toLowerCase()).filter(s => s.length > 3);

  try {
    const backendMatches = await searchDocumentBackend(text);
    if (backendMatches.length) {
      const pg = backendMatches[0].page;
      hideLoading();
      const ok = await goToPage(pg, text);
      if (!ok && backendMatches[0].snippet) await goToPage(pg, backendMatches[0].snippet);
      toast(t('toast_found_page', { n: pg }), 'success');
      return;
    }

    const n = snapDoc.numPages;
    for (let pg = 1; pg <= n; pg++) {
      const page = await snapDoc.getPage(pg);
      const content = await page.getTextContent();
      const pageText = content.items.map(i => i.str).join(' ').toLowerCase();
      const found = candidates.some(c => pageText.includes(c));
      if (found) {
        hideLoading();
        await goToPage(pg, text.slice(0, 30));
        toast(t('toast_found_page', { n: pg }), 'success');
        return;
      }
    }
    hideLoading();
    toast(t('toast_no_match'));
  } catch {
    hideLoading();
    toast(t('toast_search_failed'));
  }
}

async function downloadPdfAsMd() {
  const id = currentLibId || fileId;
  if (!id) { toast(t('toast_need_pdf')); return; }
  const source = currentLibId ? 'library' : 'upload';
  pdfToMdBtn.disabled = true;
  pdfToMdBtn.textContent = t('converting');
  try {
    const r = await fetch(`/pdf_to_md/${id}?source=${source}`);
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || t('toast_md_failed')); }
    const blob = await r.blob();
    const disposition = r.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const fname = match ? match[1] : (currentFilename.replace(/\.pdf$/i, '') || 'paper') + '.md';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(t('toast_md_done'), 'success');
  } catch (e) {
    toast(t('toast_md_failed') + e.message);
  } finally {
    pdfToMdBtn.disabled = false;
    pdfToMdBtn.textContent = pdfToMdBtn.dataset.label || '导出';
  }
}

async function handleFile(file) {
  showLoading(ui().misc.loadingPdf);
  try {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/upload', { method: 'POST', body: fd });
    if (!r.ok) throw new Error((await r.json()).detail || ui().misc.uploadFailed);
    const data = await r.json();
    // Open new tab if current tab already has a PDF, otherwise reuse it
    { const at = getActiveTab(); if (at?.pdfUrl) { saveToTab(at); const nt = makeTab(file.name); tabs.push(nt); activeTabId = nt.id; } else if (at) { at.filename = file.name; } }
    fileId = data.file_id;
    currentFilename = file.name;
    currentLibId = null;
    currentAnnotations = [];
    filenameDisplay.textContent = file.name;
    analyzeBtn.disabled = false; pdfToMdBtn.disabled = false;
    structure = null;
    sidebarBody.innerHTML = `
      <div class="empty-state">
        <div class="ei">🔍</div>
        <p>${ui().misc.clickAnalyze}</p>
      </div>`;
    battleClearContext();
    await renderPDF(`/pdf/${fileId}`);
    loadDocumentProfile(fileId, 'upload');
    renderTabBar();
  } catch (e) {
    toast(t('toast_load_failed') + e.message);
  } finally {
    hideLoading();
  }
}

async function renderPDF(url) {
  const myGen = ++_renderGen;   // claim a generation token

  pdfPages.innerHTML = '';
  renderObs.forEach(o => o.disconnect());
  renderObs = [];

  dropZone.style.display = 'none';
  pdfScroll.style.display = 'flex';
  pageBadge.style.display = 'block';

  const doc = await pdfjsLib.getDocument({
    url,
    cMapUrl: CMAP_URL,
    cMapPacked: CMAP_PACKED,
  }).promise;

  // Abort if a newer renderPDF has started while we were loading
  if (myGen !== _renderGen) return;

  pdfDoc = doc;
  { const tab = getActiveTab(); if (tab) { tab.pdfUrl = url; tab.pdfDoc = doc; } }
  const n = doc.numPages;
  totPage.textContent = n;
  curPage.textContent = 1;

  // Estimate page width for placeholders
  const firstPage = await doc.getPage(1);
  if (myGen !== _renderGen) return;
  const vp0 = firstPage.getViewport({ scale: 1 });
  const maxW = pdfScroll.clientWidth - 40;
  const scale0 = maxW / vp0.width;
  const estH = Math.round(vp0.height * scale0);

  for (let i = 1; i <= n; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'page-wrap';
    wrap.dataset.pageNum = String(i);

    // Placeholder
    const ph = document.createElement('div');
    ph.className = 'page-placeholder';
    ph.style.cssText = `width:${Math.round(vp0.width * scale0)}px;height:${estH}px;`;
    ph.textContent = t('page_label', { n: i });
    wrap.appendChild(ph);

    const lbl = document.createElement('div');
    lbl.className = 'page-num-label';
    lbl.textContent = t('page_label', { n: i });
    wrap.appendChild(lbl);

    pdfPages.appendChild(wrap);

    // Lazy render — capture doc so stale renders can't use a later tab's pdfDoc
    const obs = new IntersectionObserver(async entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && !entry.target.dataset.rendered) {
          if (myGen !== _renderGen) { obs.disconnect(); return; }
          entry.target.dataset.rendered = '1';
          obs.unobserve(entry.target);
          await renderOnePage(i, entry.target, doc);
        }
      }
    }, { root: pdfScroll, rootMargin: '300px' });

    obs.observe(wrap);
    renderObs.push(obs);
  }
}

async function renderOnePage(pageNum, wrap, doc) {
  doc = doc || pdfDoc;
  const page = await doc.getPage(pageNum);
  const maxW = pdfScroll.clientWidth - 40;
  const scale = maxW / page.getViewport({ scale: 1 }).width;
  const vp = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(vp.width);
  canvas.height = Math.round(vp.height);

  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

  const ph = wrap.querySelector('.page-placeholder');
  if (ph) ph.remove();
  const label = wrap.querySelector('.page-num-label');
  wrap.insertBefore(canvas, label);

  // Text layer for selection & highlight
  await renderTextLayer(page, vp, scale, wrap, pageNum);
}

async function renderTextLayer(page, vp, scale, wrap, pageNum) {
  const content = await page.getTextContent();
  const layer = document.createElement('div');
  layer.className = 'textLayer';
  layer.dataset.page = pageNum;
  layer.style.width  = Math.round(vp.width)  + 'px';
  layer.style.height = Math.round(vp.height) + 'px';

  let itemCount = 0;
  for (const item of content.items) {
    if (!item.str) continue;
    const [x, y] = vp.convertToViewportPoint(item.transform[4], item.transform[5]);
    const fontSize = Math.abs(item.transform[3]) * scale;
    if (fontSize < 1) continue;

    const span = document.createElement('span');
    span.textContent   = item.str;
    span.dataset.page  = pageNum;
    span.style.left    = x + 'px';
    span.style.top     = (y - fontSize) + 'px';
    span.style.fontSize = fontSize + 'px';
    if (item.width) {
      const targetW = item.width * scale;
      span.style.transform = `scaleX(${targetW / Math.max(item.str.length * fontSize * 0.55, 1)})`;
    }
    layer.appendChild(span);
    itemCount++;
  }

  // Mark any existing annotations on this page
  currentAnnotations.filter(a => a.page === pageNum).forEach(a => {
    markAnnotationInLayer(layer, a.text);
  });

  wrap.insertBefore(layer, wrap.querySelector('.page-num-label'));

  // If PDF.js found no text, try the PyMuPDF backend as a fallback (non-blocking)
  if (itemCount === 0) _tryFallbackText(layer, vp, pageNum);
}

async function _tryFallbackText(layer, vp, pageNum) {
  const id = currentLibId || fileId;
  if (!id) return;
  const source = currentLibId ? 'library' : 'upload';
  try {
    const r = await fetch(`/page_text/${id}/${pageNum}?source=${source}`);
    if (!r.ok) return;
    const data = await r.json();
    if (data.spans && data.spans.length > 0) {
      const pw = vp.width, ph = vp.height;
      for (const s of data.spans) {
        const span = document.createElement('span');
        span.textContent  = s.text;
        span.dataset.page = pageNum;
        span.style.left   = (s.x * pw) + 'px';
        span.style.top    = (s.y * ph) + 'px';
        span.style.width  = (s.w * pw) + 'px';
        span.style.fontSize = Math.max(Math.round(s.h * ph * 0.9), 6) + 'px';
        layer.appendChild(span);
      }
    } else if (data.scanned) {
      layer.dataset.scanned = '1';
      if (pdfSearchBar.classList.contains('show')) pdfSearchOcr.style.display = '';
    }
  } catch (_) {}
}

async function ocrScannedPages() {
  const s = loadSettings();
  if (!s.apiKey) { toast(t('toast_need_api_key'), 'error'); return; }
  const id = currentLibId || fileId;
  if (!id) return;
  const source = currentLibId ? 'library' : 'upload';
  const scannedLayers = [...pdfPages.querySelectorAll('.textLayer[data-scanned]')];
  if (!scannedLayers.length) { toast(t('toast_no_scanned'), 'success'); return; }

  pdfSearchOcr.disabled = true;
  for (let i = 0; i < scannedLayers.length; i++) {
    const layer = scannedLayers[i];
    const pageNum = parseInt(layer.dataset.page);
    pdfSearchCount.textContent = `OCR ${i + 1}/${scannedLayers.length}…`;
    try {
      const r = await fetch(`/page_ocr/${id}/${pageNum}?source=${source}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: s.provider || 'claude', api_key: s.apiKey, model: s.model || '' }),
      });
      if (!r.ok) continue;
      const data = await r.json();
      const vpW = parseInt(layer.style.width), vpH = parseInt(layer.style.height);
      for (const sp of data.spans) {
        const span = document.createElement('span');
        span.textContent  = sp.text;
        span.dataset.page = pageNum;
        span.style.left   = '0px';
        span.style.top    = (sp.y * vpH) + 'px';
        span.style.width  = vpW + 'px';
        span.style.fontSize = '12px';
        span.style.whiteSpace = 'normal';
        layer.appendChild(span);
      }
      delete layer.dataset.scanned;
    } catch (_) {}
  }
  pdfSearchOcr.style.display = 'none';
  pdfSearchOcr.disabled = false;
  pdfSearchCount.textContent = '';
  if (_searchTerm) executeSearch(_searchTerm);
  else toast(t('toast_ocr_done'), 'success');
}

function updateBadge() {
  if (!pdfDoc) return;
  const scrollTop   = pdfScroll.scrollTop;
  const scrollBot   = scrollTop + pdfScroll.clientHeight;
  const wraps = pdfPages.querySelectorAll('.page-wrap');
  for (const w of wraps) {
    const top = w.offsetTop;
    if (top + w.offsetHeight > scrollTop && top < scrollBot) {
      curPage.textContent = w.dataset.pageNum;
      return;
    }
  }
}

async function goToPage(pageNum, textHint) {
  const wrap = pdfPages.querySelector(`[data-page-num="${pageNum}"]`);
  if (!wrap) return false;
  wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  curPage.textContent = pageNum;

  // Remove any existing highlights
  document.querySelectorAll('.text-highlight').forEach(el => el.remove());
  document.querySelectorAll('.textLayer span.hl').forEach(el => el.classList.remove('hl'));

  if (textHint && pdfDoc) {
    const snapDoc = pdfDoc;
    // Ensure page is rendered before searching text
    if (!wrap.dataset.rendered) await renderOnePage(pageNum, wrap, snapDoc);
    const found = await highlightTextOnPage(pageNum, textHint, wrap);
    if (!found) {
      wrap.classList.remove('flash');
      void wrap.offsetWidth;
      wrap.classList.add('flash');
      setTimeout(() => wrap.classList.remove('flash'), 2000);
    }
    return found;
  } else {
    wrap.classList.remove('flash');
    void wrap.offsetWidth;
    wrap.classList.add('flash');
    setTimeout(() => wrap.classList.remove('flash'), 2000);
    return true;
  }
}

async function highlightTextOnPage(pageNum, textHint, wrap) {
  const snapDoc = pdfDoc;
  try {
    // Ensure text layer exists
    let layer = wrap.querySelector('.textLayer');
    if (!layer) {
      const page  = await snapDoc.getPage(pageNum);
      const canvas = wrap.querySelector('canvas');
      if (!canvas) return false;
      const scale = canvas.width / page.getViewport({ scale: 1 }).width;
      await renderTextLayer(page, page.getViewport({ scale }), scale, wrap, pageNum);
      layer = wrap.querySelector('.textLayer');
    }
    if (!layer) return false;

    const spans = Array.from(layer.querySelectorAll('span'));
    const hitSpans = spanRangesForQuery(spans, textHint);
    if (!hitSpans.length) return false;

    const matchSpan = hitSpans[0];
    const matchTop  = parseFloat(matchSpan.style.top);
    const fontSize  = parseFloat(matchSpan.style.fontSize) || 12;
    const band      = fontSize * 3;

    const sameLine = spans.filter(s => Math.abs(parseFloat(s.style.top) - matchTop) <= band);
    const toHL = hitSpans.length >= 2 ? hitSpans : sameLine;
    toHL.forEach(s => s.classList.add('hl'));
    setTimeout(() => toHL.forEach(s => s.classList.remove('hl')), 7000);

    matchSpan.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  } catch { return false; }
}
