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

function getPdfIdentity() {
  return {
    fileId: window.fileId || null,
    libId: window.currentLibId || null,
    tabId: window.activeTabId || null,
    renderGen: window._renderGen || 0,
    doc: window.pdfDoc || null,
  };
}

function samePdfIdentity(a, b) {
  return !!a && !!b &&
    a.fileId === b.fileId &&
    a.libId === b.libId &&
    a.tabId === b.tabId &&
    a.renderGen === b.renderGen &&
    a.doc === b.doc;
}

function getPdfSourceFromIdentity(identity) {
  return identity?.libId ? 'library' : 'upload';
}

function stampPdfContext(el, identity, extra = {}) {
  if (!el || !identity) return;
  if (identity.fileId) el.dataset.fileId = identity.fileId;
  else delete el.dataset.fileId;
  if (identity.libId) el.dataset.libId = identity.libId;
  else delete el.dataset.libId;
  el.dataset.renderGen = String(identity.renderGen || 0);
  if (identity.tabId) el.dataset.tabId = String(identity.tabId);
  else delete el.dataset.tabId;
  Object.entries(extra).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') delete el.dataset[k];
    else el.dataset[k] = String(v);
  });
}

function elementMatchesPdfIdentity(el, identity) {
  if (!el || !identity) return false;
  return (el.dataset.fileId || '') === (identity.fileId || '') &&
    (el.dataset.libId || '') === (identity.libId || '') &&
    (el.dataset.renderGen || '0') === String(identity.renderGen || 0) &&
    (el.dataset.tabId || '') === String(identity.tabId || '');
}

function getIdentityFromElement(el) {
  if (!el) return null;
  return {
    fileId: el.dataset.fileId || null,
    libId: el.dataset.libId || null,
    tabId: el.dataset.tabId || null,
    renderGen: parseInt(el.dataset.renderGen || '0', 10) || 0,
    doc: window.pdfDoc || null,
  };
}

function getWrapForPage(pageNum, identity = getPdfIdentity()) {
  const wrap = pdfPages.querySelector(`[data-page-num="${pageNum}"]`);
  if (!wrap || !elementMatchesPdfIdentity(wrap, identity)) return null;
  return wrap;
}

function centerWrapInView(wrap) {
  if (!wrap) return;
  const target = Math.max(0, wrap.offsetTop - ((pdfScroll.clientHeight - wrap.offsetHeight) / 2));
  pdfScroll.scrollTo({ top: target, behavior: 'smooth' });
}

function centerElementInView(el, wrap) {
  if (!el || !wrap) return;
  const elTop = (parseFloat(el.style.top) || 0) + wrap.offsetTop;
  const elHeight = parseFloat(el.style.fontSize) || el.offsetHeight || 18;
  const target = Math.max(0, elTop - ((pdfScroll.clientHeight - elHeight) / 2));
  pdfScroll.scrollTo({ top: target, behavior: 'smooth' });
}

function normalizeLocator(locator) {
  if (typeof locator === 'string') {
    return {
      quote: locator,
      hint: locator,
      snippet: locator,
      page: null,
      label: '',
    };
  }
  locator = locator || {};
  return {
    quote: locator.quote || '',
    hint: locator.hint || locator.quote || '',
    snippet: locator.snippet || locator.hint || locator.quote || '',
    page: locator.page || null,
    label: locator.label || '',
  };
}

function makeQueryCandidates(locator) {
  const values = [locator.quote, locator.hint, locator.snippet, locator.label]
    .map(v => String(v || '').trim())
    .filter(Boolean);
  const uniq = [];
  for (const val of values) {
    if (!uniq.includes(val)) uniq.push(val);
  }
  return uniq.sort((a, b) => b.length - a.length);
}

function significantWords(text) {
  const seen = new Set();
  const words = [];
  for (const raw of String(text || '').split(/[^\p{L}\p{N}]+/u)) {
    const w = normalizeFindText(raw);
    if (w.length < 5 || seen.has(w)) continue;
    seen.add(w);
    words.push(w);
  }
  return words.sort((a, b) => b.length - a.length);
}

function buildTextBlocks(spans) {
  if (!spans.length) return [];
  const items = spans.map(span => ({
    span,
    top: parseFloat(span.style.top) || 0,
    left: parseFloat(span.style.left) || 0,
    width: span.offsetWidth || ((parseFloat(span.style.fontSize) || 12) * Math.max(span.textContent.length * 0.55, 1)),
    height: parseFloat(span.style.fontSize) || span.offsetHeight || 12,
    text: span.textContent || '',
  })).sort((a, b) => (a.top - b.top) || (a.left - b.left));

  const lines = [];
  for (const item of items) {
    const last = lines[lines.length - 1];
    const tol = Math.max(6, item.height * 0.65);
    if (last && Math.abs(last.top - item.top) <= tol) {
      last.items.push(item);
      last.top = Math.min(last.top, item.top);
      last.bottom = Math.max(last.bottom, item.top + item.height);
    } else {
      lines.push({
        top: item.top,
        bottom: item.top + item.height,
        items: [item],
      });
    }
  }

  lines.forEach(line => line.items.sort((a, b) => a.left - b.left));

  const blocks = [];
  for (const line of lines) {
    const lineText = line.items.map(i => i.text).join(' ').trim();
    if (!lineText) continue;
    const lineHeight = Math.max(...line.items.map(i => i.height), 12);
    const last = blocks[blocks.length - 1];
    const gap = last ? line.top - last.bottom : Infinity;
    const shouldMerge = !!last && gap <= Math.max(14, lineHeight * 1.15);
    if (shouldMerge) {
      last.lines.push(line);
      last.items.push(...line.items);
      last.text += ' ' + lineText;
      last.bottom = Math.max(last.bottom, line.bottom);
    } else {
      blocks.push({
        lines: [line],
        items: [...line.items],
        text: lineText,
        top: line.top,
        bottom: line.bottom,
      });
    }
  }

  return blocks.map(block => {
    const left = Math.min(...block.items.map(i => i.left));
    const right = Math.max(...block.items.map(i => i.left + i.width));
    const top = Math.min(...block.items.map(i => i.top));
    const bottom = Math.max(...block.items.map(i => i.top + i.height));
    return {
      spans: block.items.map(i => i.span),
      text: block.text.trim(),
      norm: normalizeFindText(block.text),
      top,
      left,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  });
}

function scoreBlockAgainstQueries(block, queries) {
  let best = 0;
  for (const q of queries) {
    const norm = normalizeFindText(q);
    if (!norm) continue;
    if (block.norm.includes(norm)) best = Math.max(best, 1000 + norm.length);
    const words = significantWords(q).slice(0, 6);
    if (words.length) {
      const hits = words.filter(w => block.norm.includes(w));
      if (hits.length >= Math.min(2, words.length)) {
        const hitScore = hits.reduce((sum, w) => sum + w.length, 0);
        best = Math.max(best, 100 + hitScore);
      }
    }
  }
  return best;
}

function clearBlockHighlights() {
  document.querySelectorAll('.text-highlight').forEach(el => el.remove());
}

function highlightBlock(wrap, block, className = 'text-highlight') {
  if (!wrap || !block) return null;
  const box = document.createElement('div');
  box.className = className;
  box.style.position = 'absolute';
  box.style.left = Math.max(0, block.left - 6) + 'px';
  box.style.top = Math.max(0, block.top - 4) + 'px';
  box.style.width = (block.width + 12) + 'px';
  box.style.height = (block.height + 8) + 'px';
  box.style.border = '2px solid rgba(250, 204, 21, 0.95)';
  box.style.background = 'rgba(250, 204, 21, 0.14)';
  box.style.borderRadius = '8px';
  box.style.boxShadow = '0 0 0 3px rgba(250, 204, 21, 0.18)';
  box.style.pointerEvents = 'none';
  box.style.zIndex = '3';
  wrap.appendChild(box);
  setTimeout(() => {
    box.remove();
  }, 7000);
  return box;
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

function exactSpanRangesForQuery(spans, query) {
  const needle = normalizeFindText(query);
  if (!needle || needle.length < 2) return [];

  let full = '';
  const ranges = [];
  for (const span of spans) {
    const start = full.length;
    const norm = normalizeFindText(span.textContent);
    full += norm;
    ranges.push({ span, start, end: full.length });
  }

  const pos = full.indexOf(needle);
  if (pos < 0) return [];
  const end = pos + needle.length;
  return ranges
    .filter(r => r.end > pos && r.start < end)
    .map(r => r.span);
}

function highlightSpanGroup(spans, cls = 'hl-search') {
  spans.forEach(s => s.classList.add(cls));
  return spans[0] || null;
}

async function executeSearch(term) {
  const seq = ++_searchSeq;
  const identity = getPdfIdentity();
  clearSearchHighlights();
  _searchMatches = [];
  _searchIdx = -1;
  _searchTerm = term;
  if (!term || !pdfDoc) { pdfSearchCount.textContent = ''; return; }

  const layers = Array.from(pdfPages.querySelectorAll('.textLayer'))
    .filter(layer => elementMatchesPdfIdentity(layer, identity));
  layers.forEach(layer => {
    const spans = Array.from(layer.querySelectorAll('span'));
    const hits = exactSpanRangesForQuery(spans, term);
    if (hits.length) {
      highlightSpanGroup(hits, 'hl-search');
      _searchMatches.push({ pageNum: parseInt(layer.dataset.page) || 1, el: hits[0], els: hits, query: term, identity });
    }
  });

  if (_searchMatches.length === 0) {
    pdfSearchCount.textContent = ui().misc.searchLoading;
    const backendMatches = await searchDocumentBackend(term, identity);
    if (seq !== _searchSeq || !samePdfIdentity(identity, getPdfIdentity())) return;
    _searchMatches = backendMatches.map(m => ({
      pageNum: m.page,
      el: null,
      snippet: m.snippet || '',
      query: term,
      fallbackQuery: m.snippet || '',
      identity,
    }));
  }

  if (_searchMatches.length === 0) {
    pdfSearchCount.textContent = t('search_no_result');
    return;
  }
  _searchIdx = 0;
  navigateSearchMatch();
}

async function searchDocumentBackend(term, identity = getPdfIdentity()) {
  const id = identity?.libId || identity?.fileId;
  if (!id) return [];
  const source = getPdfSourceFromIdentity(identity);
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
  const identity = match.identity || getPdfIdentity();
  if (!samePdfIdentity(identity, getPdfIdentity())) return;
  pdfSearchCount.textContent = t('search_count', { a: _searchIdx + 1, b: _searchMatches.length });
  pdfSearchPrev.disabled = _searchIdx <= 0;
  pdfSearchNext.disabled = _searchIdx >= _searchMatches.length - 1;
  if (match.el) {
    (match.els || [match.el]).forEach(el => el?.classList.add('current'));
    const wrap = getWrapForPage(match.pageNum, identity);
    if (wrap) centerElementInView(match.el, wrap);
  } else {
    const primary = match.fallbackQuery || match.query || _searchTerm;
    const ok = await goToPage(match.pageNum, {
      snippet: match.fallbackQuery || '',
      hint: primary,
      quote: match.query || _searchTerm || '',
      page: match.pageNum,
    }, identity);
    if (!ok && match.query) {
      await goToPage(match.pageNum, {
        hint: match.query,
        quote: match.query,
        page: match.pageNum,
      }, identity);
    }
  }
}

async function searchCitationInPDF(target) {
  const locator = normalizeLocator(target);
  if (!locator.quote && !locator.hint && !locator.snippet) return;
  if (!pdfDoc) { toast(t('toast_need_pdf')); return; }
  const identity = getPdfIdentity();
  const snapDoc = identity.doc;
  showLoading(ui().misc.searchOriginal);
  const candidates = makeQueryCandidates(locator);

  try {
    if (locator.page) {
      const pageOk = await goToPage(locator.page, locator, identity);
      if (pageOk) {
        hideLoading();
        toast(t('toast_found_page', { n: locator.page }), 'success');
        return;
      }
    }

    const backendMatches = await searchDocumentBackend(candidates[0] || locator.quote || locator.hint, identity);
    if (!samePdfIdentity(identity, getPdfIdentity())) {
      hideLoading();
      return;
    }
    if (backendMatches.length) {
      const pg = backendMatches[0].page;
      hideLoading();
      const ok = await goToPage(pg, {
        ...locator,
        page: pg,
        snippet: backendMatches[0].snippet || locator.snippet || locator.quote,
      }, identity);
      if (!ok && backendMatches[0].snippet) {
        await goToPage(pg, { ...locator, page: pg, hint: backendMatches[0].snippet, snippet: backendMatches[0].snippet }, identity);
      }
      toast(t('toast_found_page', { n: pg }), 'success');
      return;
    }

    const n = snapDoc.numPages;
    for (let pg = 1; pg <= n; pg++) {
      if (!samePdfIdentity(identity, getPdfIdentity())) {
        hideLoading();
        return;
      }
      const page = await snapDoc.getPage(pg);
      const content = await page.getTextContent();
      const pageText = content.items.map(i => i.str).join(' ').toLowerCase();
      const found = candidates.some(c => pageText.includes(String(c).toLowerCase()));
      if (found) {
        hideLoading();
        await goToPage(pg, { ...locator, page: pg }, identity);
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
  const identity = getPdfIdentity();

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
    stampPdfContext(wrap, { ...identity, renderGen: myGen, doc }, { pageNum: i });

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
  stampPdfContext(canvas, getIdentityFromElement(wrap) || getPdfIdentity(), {
    page: pageNum,
    scale: scale.toFixed(6),
    width: vp.width,
    height: vp.height,
  });

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
  stampPdfContext(layer, getIdentityFromElement(wrap) || getPdfIdentity(), {
    page: pageNum,
    scale: scale.toFixed(6),
    width: vp.width,
    height: vp.height,
  });

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
  const identity = getPdfIdentity();
  const id = identity.libId || identity.fileId;
  if (!id) return;
  const source = getPdfSourceFromIdentity(identity);
  try {
    const r = await fetch(`/page_text/${id}/${pageNum}?source=${source}`);
    if (!r.ok) return;
    const data = await r.json();
    if (!samePdfIdentity(identity, getPdfIdentity()) || !elementMatchesPdfIdentity(layer, identity)) return;
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

async function goToPage(pageNum, target, identity = getPdfIdentity()) {
  const locator = normalizeLocator(target);
  if (!samePdfIdentity(identity, getPdfIdentity())) return false;
  const wrap = getWrapForPage(pageNum, identity);
  if (!wrap) return false;
  centerWrapInView(wrap);
  curPage.textContent = pageNum;

  // Remove any existing highlights
  clearBlockHighlights();
  document.querySelectorAll('.textLayer span.hl').forEach(el => el.classList.remove('hl'));

  if ((locator.quote || locator.hint || locator.snippet) && identity.doc) {
    const snapDoc = identity.doc;
    // Ensure page is rendered before searching text
    if (!wrap.dataset.rendered) await renderOnePage(pageNum, wrap, snapDoc);
    if (!samePdfIdentity(identity, getPdfIdentity())) return false;
    const found = await highlightTextOnPage(pageNum, locator, wrap, identity);
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

async function highlightTextOnPage(pageNum, target, wrap, identity = getPdfIdentity()) {
  const locator = normalizeLocator(target);
  const snapDoc = identity.doc;
  try {
    if (!samePdfIdentity(identity, getPdfIdentity()) || !elementMatchesPdfIdentity(wrap, identity)) return false;
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
    if (!layer || !elementMatchesPdfIdentity(layer, identity)) return false;

    const spans = Array.from(layer.querySelectorAll('span'));
    const blocks = buildTextBlocks(spans);
    const queries = makeQueryCandidates(locator);
    let bestBlock = null;
    let bestScore = 0;
    for (const block of blocks) {
      const score = scoreBlockAgainstQueries(block, queries);
      if (score > bestScore) {
        bestScore = score;
        bestBlock = block;
      }
    }

    if (bestBlock && bestScore >= 20) {
      highlightBlock(wrap, bestBlock);
      const centerEl = bestBlock.spans[Math.floor(bestBlock.spans.length / 2)] || bestBlock.spans[0];
      centerElementInView(centerEl, wrap);
      return true;
    }

    const hitSpans = spanRangesForQuery(spans, locator.hint || locator.quote || locator.snippet);
    if (!hitSpans.length) return false;

    const matchSpan = hitSpans[0];
    const matchTop  = parseFloat(matchSpan.style.top);
    const fontSize  = parseFloat(matchSpan.style.fontSize) || 12;
    const band      = fontSize * 3;
    const sameLine = spans.filter(s => Math.abs(parseFloat(s.style.top) - matchTop) <= band);
    const lineBlock = {
      spans: hitSpans.length >= 2 ? hitSpans : sameLine,
      left: Math.min(...(hitSpans.length >= 2 ? hitSpans : sameLine).map(s => parseFloat(s.style.left) || 0)),
      top: Math.min(...(hitSpans.length >= 2 ? hitSpans : sameLine).map(s => parseFloat(s.style.top) || 0)),
      right: Math.max(...(hitSpans.length >= 2 ? hitSpans : sameLine).map(s => (parseFloat(s.style.left) || 0) + (s.offsetWidth || 0))),
      bottom: Math.max(...(hitSpans.length >= 2 ? hitSpans : sameLine).map(s => (parseFloat(s.style.top) || 0) + (parseFloat(s.style.fontSize) || s.offsetHeight || 12))),
    };
    lineBlock.width = lineBlock.right - lineBlock.left;
    lineBlock.height = lineBlock.bottom - lineBlock.top;

    highlightBlock(wrap, lineBlock);
    centerElementInView(matchSpan, wrap);
    return true;
  } catch { return false; }
}
