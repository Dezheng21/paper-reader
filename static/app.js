'use strict';

// ── PDF.js setup ─────────────────────────────────────────────────────────────
var pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// CMap needed for CJK (Chinese/Japanese/Korean) characters in PDFs
// unpkg provides direct file access, cdnjs does not serve subdirectories
var CMAP_URL    = 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/';
var CMAP_PACKED = true;

// ── State ─────────────────────────────────────────────────────────────────────
var pdfDoc      = null;
var fileId      = null;
var structure   = null;

var depth       = 'brief';
var renderObs   = [];
var _renderGen  = 0;   // incremented on every renderPDF call; stale renders self-abort

// ── UI i18n ────────────────────────────────────────────────────────────────────
// All translation data and the t / lab / ui / fillVars helpers live in
// static/i18n.js, which is loaded BEFORE this file. It exposes on window:
//   t, lab, ui, fillVars, _uiLang, LANG_CODE, LANG_DISPLAY, I18N.
// To add a translation key: edit ONE place — static/i18n.js.

// Localized page / line-range labels
function pageLabel(n) { return t('page_label', { n }); }
function linesLabel(r) { return t('lines_label', { r }); }

function applySurfaceI18n() {
  const c = ui();
  document.title = t('title');

  // Search and reader controls.
  $('pdfSearchPrev').title = c.misc.prev;
  $('pdfSearchNext').title = c.misc.next;
  $('pdfSearchOcr').title = c.misc.ocr;
  $('pdfSearchClose').title = c.misc.close;
  $('fontDecBtn').title = c.misc.fontDec;
  $('fontIncBtn').title = c.misc.fontInc;
  $('exportBtn').title = c.misc.exportMd;

  // Intent, library, settings, and KnowKnow surfaces.
  applyIntentUi();
  $('libOrganizeBtn').textContent = c.lib.organize;
  $('libOrganizeBtn').title = c.lib.organizeTitle;
  $('libExportBtn').textContent = c.lib.export;
  $('libExportBtn').title = c.lib.exportTitle;

  const maxHint = document.querySelector('#maxCharsIn')?.closest('.field')?.querySelector('small');
  if (maxHint) maxHint.textContent = c.settings.maxHint;
  updateMaxCharsInfo();
  applyKnowKnowUi();
}

function setUiLang(langVal) {
  _uiLang = LANG_CODE[langVal] || 'zh';
  localStorage.setItem('pr_ui_lang', langVal);
  topbarLangSel.value = langVal;

  // Static topbar
  $('appTitle').textContent           = t('title');
  $('openPaperText').textContent      = t('open_paper');
  $('analyzeBtn').textContent         = t('analyze_btn');
  $('learnLangText').textContent      = t('learn_lang');
  $('learnLangTooltip').textContent   = t('learnlang_tooltip');
  $('libraryText').textContent        = t('library');
  $('settingsText').textContent       = t('settings');
  $('pdfToMdBtn').dataset.label       = t('export_btn').replace('↓ ', '');
  $('pdfToMdBtn').textContent         = t('export_btn').replace('↓ ', '');

  // Sidebar controls
  const scl = document.querySelector('.sidebar-controls-label');
  if (scl) scl.textContent = t('sidebar_label');
  $('exportBtn').textContent = t('export_btn');
  $('exportBtn').title = t('export_btn').replace('↓ ', '');

  // Output-language label in analysis modal
  const ill = $('intentLangLabel');
  if (ill) ill.textContent = t('label_output_lang');

  // If a cognition layer is rendered, also refresh the toggle text
  const dtx = $('detailsToggleText');
  if (dtx) {
    const layer = $('detailsLayer');
    const isCollapsed = layer ? layer.classList.contains('collapsed') : true;
    dtx.textContent = isCollapsed ? t('expand_full') : t('collapse_full');
  }

  // Analyze status default (only update if not currently active)
  if (analyzeStatus.style.display === 'none') {
    analyzeStatusText.textContent = t('analyzing');
  }

  // Empty state
  const ep = document.querySelector('.empty-state p');
  if (ep) ep.innerHTML = t('empty_state');

  // Drop zone
  const dzp = $('dropZone') && $('dropZone').querySelector('p');
  if (dzp) dzp.textContent = t('drop_zone');

  // Selection bar
  $('selCopyBtn').textContent  = t('copy');
  $('selAnnotBtn').textContent = t('add_note');

  // Annotation popup
  $('annotNote').placeholder   = t('add_note_ph');
  $('annotCancel').textContent = t('cancel');
  $('annotSave').textContent   = t('save_note');

  // PDF search bar
  $('pdfSearchInput').placeholder = t('search_ph');

  // Settings modal
  const sh = document.querySelector('#settingsOverlay .modal-head span');
  if (sh) sh.textContent = t('settings_title');
  const settingsLabels = document.querySelectorAll('#settingsOverlay .field label');
  if (settingsLabels[0]) settingsLabels[0].textContent = t('label_provider');
  if (settingsLabels[1]) {
    settingsLabels[1].childNodes[0].textContent = t('label_apikey') + ' ';
  }
  if (settingsLabels[2]) settingsLabels[2].textContent = t('label_output_lang');
  if (settingsLabels[3]) {
    settingsLabels[3].childNodes[0].textContent = t('label_model') + ' ';
    const modelOpt = settingsLabels[3].querySelector('.opt');
    if (modelOpt) modelOpt.textContent = t('label_model_opt');
  }
  $('apiKeyIn').placeholder    = t('api_key_ph');
  $('validateBtn').textContent = t('validate_btn');
  $('modelIn').placeholder     = t('model_ph');
  $('saveBtn').textContent     = t('save_btn');
  const settingsSmalls = document.querySelectorAll('#settingsOverlay small');
  if (settingsSmalls[0]) settingsSmalls[0].textContent = t('api_local_note');
  if (settingsSmalls[1]) settingsSmalls[1].textContent = t('output_lang_note');

  // Intent modal
  const ih = document.querySelector('#intentOverlay .modal-head span');
  if (ih) ih.textContent = t('intent_title');
  const intentPurposeLabel = document.querySelector('#intentOverlay .field > label');
  if (intentPurposeLabel) intentPurposeLabel.textContent = t('intent_purpose');
  $('intentQuestion').placeholder = t('intent_question_ph');
  const intentTipEl = document.querySelector('#intentOverlay .tip-empty');
  if (intentTipEl) intentTipEl.textContent = t('intent_tip');
  $('intentConfirm').textContent = t('intent_confirm');

  // Library modal
  const lh = document.querySelector('#libraryOverlay .lib-head h2');
  if (lh) lh.textContent = t('lib_title');
  $('libSearch').placeholder = t('lib_search_ph');

  // Filename if no file open
  if (!pdfDoc) {
    $('filenameDisplay').textContent = t('no_file');
  }

  // Tab new button title
  const tabNewBtn = $('tabNewBtn');
  if (tabNewBtn) tabNewBtn.title = t('tab_new_title');

  applySurfaceI18n();
  if (structure) {
    syncEditableToStructure();
    renderStructure(structure);
  }
}

// ── Tabs ──────────────────────────────────────────────────────
var tabs = [];
var activeTabId = null;

function _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

function makeTab(filename) {
  return { id: _uid(), filename: filename || ui().misc.newPaper, fileId: null, libId: null,
           pdfUrl: null, pdfDoc: null, structure: null, annotations: [], scrollTop: 0 };
}

function getActiveTab() { return tabs.find(t => t.id === activeTabId) || null; }

function saveToTab(tab) {
  if (!tab) return;
  tab.fileId      = fileId;
  tab.libId       = currentLibId;
  tab.pdfDoc      = pdfDoc;
  tab.structure   = structure;
  tab.filename    = currentFilename;
  tab.annotations = currentAnnotations.slice();
  tab.scrollTop   = pdfScroll.scrollTop;
  if (pdfDoc && tab.pdfUrl) {/* keep pdfUrl set during load */}
}

async function switchToTab(id) {
  if (id === activeTabId) return;
  saveToTab(getActiveTab());
  activeTabId = id;
  const tab = getActiveTab();
  fileId             = tab.fileId;
  currentLibId       = tab.libId;
  pdfDoc             = null;                // will be re-loaded
  structure          = tab.structure;
  currentFilename    = tab.filename;
  currentAnnotations = tab.annotations.slice();
  renderObs.forEach(o => o.disconnect());
  renderObs = [];

  filenameDisplay.textContent = tab.filename || t('no_file');
  analyzeBtn.disabled = !tab.pdfUrl; pdfToMdBtn.disabled = !tab.pdfUrl;

  if (tab.pdfUrl) {
    await renderPDF(tab.pdfUrl);
    requestAnimationFrame(() => { pdfScroll.scrollTop = tab.scrollTop; });
  } else {
    pdfPages.innerHTML = '';
    dropZone.style.display = '';
    pdfScroll.style.display = 'none';
    pageBadge.style.display = 'none';
  }

  if (tab.structure) {
    renderStructure(tab.structure);
    battleSetContext(tab.structure);
  } else {
    sidebarBody.innerHTML = `<div class="empty-state"><div class="ei">🔍</div><p>${ui().misc.clickAnalyze}</p></div>`;
    renderAnnotations();
    battleClearContext();
  }
  renderTabBar();
}

function openNewTab() {
  saveToTab(getActiveTab());
  const tab = makeTab();
  tabs.push(tab);
  activeTabId = tab.id;
  fileId = null; currentLibId = null; pdfDoc = null; structure = null;
  currentFilename = ''; currentAnnotations = [];
  renderObs.forEach(o => o.disconnect()); renderObs = [];
  filenameDisplay.textContent = t('no_file');
  analyzeBtn.disabled = true; pdfToMdBtn.disabled = true;
  pdfPages.innerHTML = '';
  dropZone.style.display = '';
  pdfScroll.style.display = 'none';
  pageBadge.style.display = 'none';
  sidebarBody.innerHTML = `<div class="empty-state"><div class="ei">📋</div><p>${ui().misc.openAnalyze}</p></div>`;
  battleClearContext();
  renderTabBar();
}

function closeTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  tabs.splice(idx, 1);
  if (tabs.length === 0) { openNewTab(); return; }
  if (activeTabId === id) { activeTabId = null; switchToTab(tabs[Math.min(idx, tabs.length - 1)].id); }
  else renderTabBar();
}

function renderTabBar() {
  const list = $('tabsList');
  if (!list) return;
  list.innerHTML = tabs.map(t => {
    const name = (t.filename || '新论文').replace(/\.pdf$/i, '');
    const label = name.length > 22 ? name.slice(0, 22) + '…' : name;
    return `<div class="tab${t.id === activeTabId ? ' active' : ''}" data-tab="${t.id}">
      <span class="tab-title" title="${esc(name)}">${esc(label)}</span>
      <button class="tab-close" data-close="${t.id}">×</button>
    </div>`;
  }).join('');
}

var SETTINGS_KEY = 'pr_settings';
var MODEL_HINTS = {
  claude:  'claude-sonnet-4-6 (recommended)\nclaude-opus-4-7 (strongest)\nclaude-haiku-4-5-20251001 (fastest)',
  openai:  'gpt-4o (recommended)\ngpt-4o-mini (faster)',
  gemini:  'gemini-2.5-flash (recommended)\ngemini-2.5-flash-lite (faster / cheaper)\ngemini-2.5-pro (strongest)',
  deepseek:'deepseek-chat (recommended)\ndeepseek-reasoner (stronger reasoning)',
  groq:    'llama-3.3-70b-versatile (recommended)\nllama-3.1-8b-instant (faster)',
  mistral: 'mistral-small-latest (recommended)\nmistral-medium-latest (stronger)',
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
var $ = id => document.getElementById(id);
var fileInput       = $('fileInput');
var filenameDisplay = $('filenameDisplay');
var analyzeBtn      = $('analyzeBtn');
var pdfToMdBtn      = $('pdfToMdBtn');
var settingsBtn     = $('settingsBtn');
var settingsOverlay = $('settingsOverlay');
var settingsClose   = $('settingsClose');
var saveBtn         = $('saveBtn');
var providerSel     = $('providerSel');
var apiKeyIn        = $('apiKeyIn');
var modelIn         = $('modelIn');
var modelHints      = $('modelHints');
var langSel         = $('langSel');
var maxCharsIn      = $('maxCharsIn');
var maxCharsVal     = $('maxCharsVal');
var maxCharsInfo    = $('maxCharsInfo');
var topbarLangSel   = $('topbarLangSel');
var validateBtn     = $('validateBtn');
var validateResult  = $('validateResult');
var loadingOverlay  = $('loadingOverlay');
var loadingMsg      = $('loadingMsg');
var analyzeStatus   = $('analyzeStatus');
var analyzeStatusText = $('analyzeStatusText');
var sidebarBody     = $('sidebarBody');
var dropZone        = $('dropZone');
var pdfScroll       = $('pdfScroll');
var pdfPages        = $('pdfPages');
var pageBadge       = $('pageBadge');
var curPage         = $('curPage');
var totPage         = $('totPage');
var libraryBtn      = $('libraryBtn');
var libraryOverlay  = $('libraryOverlay');
var libraryClose    = $('libraryClose');
var libOrganizeBtn  = $('libOrganizeBtn');
var libExportBtn    = $('libExportBtn');
var libBody         = $('libBody');
var libSearch       = $('libSearch');
var learnLangBtn    = $('learnLangBtn');
var intentOverlay   = $('intentOverlay');
var intentClose     = $('intentClose');
var intentConfirm   = $('intentConfirm');
var intentOpts      = $('intentOpts');
var intentQuestion  = $('intentQuestion');
var annotPopup      = $('annotPopup');
var annotQuote      = $('annotQuote');
var annotNote       = $('annotNote');
var annotSave       = $('annotSave');
var annotCancel     = $('annotCancel');
var selBar          = $('selBar');
var selCopyBtn      = $('selCopyBtn');
var selAnnotBtn     = $('selAnnotBtn');
var pdfSearchBar    = $('pdfSearchBar');
var pdfSearchInput  = $('pdfSearchInput');
var pdfSearchCount  = $('pdfSearchCount');
var pdfSearchPrev   = $('pdfSearchPrev');
var pdfSearchNext   = $('pdfSearchNext');
var pdfSearchClose  = $('pdfSearchClose');
var pdfSearchOcr    = $('pdfSearchOcr');
var sidebar         = $('sidebar');
var resizeHandle    = $('resizeHandle');
var fontDecBtn      = $('fontDecBtn');
var fontIncBtn      = $('fontIncBtn');
var intentDesc      = $('intentDesc');

var currentFilename    = '';
var guideFontSize      = parseInt(localStorage.getItem('pr_font_size') || '14');
var libAllItems        = [];
var learnLang          = false;
var currentIntent      = 'quick';
var currentQuestion    = '';
var currentLibId       = null;
var currentAnnotations = [];
var pendingAnnotation  = null;   // { text, page } while popup is open
var _selText = '', _selPage = 1; // current selection for selBar

// ── Search state ──────────────────────────────────────────────────────────────
var _searchMatches = [];  // [{pageNum, spanEl}]
var _searchIdx     = -1;
var _searchTerm    = '';
var _searchSeq     = 0;

// ── Annotations ───────────────────────────────────────────────────────────────
function onTextSelected(e) {
  if (annotPopup.contains(e.target) || selBar.contains(e.target)) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) { hideSelBar(); return; }
  const text = sel.toString().trim();
  if (!text || text.length < 2) { hideSelBar(); return; }

  // Only trigger inside a text layer
  const node = sel.anchorNode;
  const layer = node && (node.closest ? node.closest('.textLayer') : node.parentElement?.closest('.textLayer'));
  if (!layer) { hideSelBar(); return; }

  const page = parseInt(layer.dataset.page) || 1;
  _selText = text;
  _selPage = page;

  // Show selection toolbar near cursor
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = e.clientX - 40, top = e.clientY - 52;
  if (left < 4) left = 4;
  if (left + 180 > vw) left = vw - 184;
  if (top < 4) top = e.clientY + 16;
  selBar.style.left = left + 'px';
  selBar.style.top  = top  + 'px';
  selBar.classList.add('show');
}

function hideSelBar() {
  selBar.classList.remove('show');
}

function hideAnnotationPopup() {
  const wasShowing = annotPopup.classList.contains('show');
  annotPopup.classList.remove('show');
  pendingAnnotation = null;
  if (wasShowing) window.getSelection()?.removeAllRanges();
}

function openAnnotPopupForSel() {
  if (!_selText) return;
  pendingAnnotation = { text: _selText, page: _selPage };
  annotQuote.textContent = _selText.length > 80 ? _selText.slice(0, 80) + '…' : _selText;
  annotNote.value = '';
  const vw = window.innerWidth, vh = window.innerHeight;
  const barRect = selBar.getBoundingClientRect();
  let left = barRect.left, top = barRect.bottom + 8;
  if (left + 276 > vw) left = vw - 280;
  if (top + 200  > vh) top  = barRect.top - 220;
  annotPopup.style.left = left + 'px';
  annotPopup.style.top  = top  + 'px';
  annotPopup.classList.add('show');
  hideSelBar();
  setTimeout(() => annotNote.focus(), 50);
}

// ── PDF search ────────────────────────────────────────────────────────────────

async function saveAnnotation() {
  if (!pendingAnnotation) return;
  const note = annotNote.value.trim();
  if (!note) { annotNote.focus(); return; }

  const annot = {
    id:         Date.now().toString(36) + Math.random().toString(36).slice(2),
    page:       pendingAnnotation.page,
    text:       pendingAnnotation.text,
    note,
    created_at: new Date().toLocaleString('zh-CN'),
  };

  currentAnnotations.push(annot);
  hideAnnotationPopup();

  // Mark in text layer
  const layer = pdfPages.querySelector(`.textLayer[data-page="${annot.page}"]`);
  if (layer) markAnnotationInLayer(layer, annot.text);

  // Persist if paper is in library
  if (currentLibId) {
    await fetch(`/library/${currentLibId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annot),
    }).catch(() => {});
  }

  renderAnnotations();
  toast(t('toast_note_saved'), 'success');
}

async function deleteAnnotation(id) {
  currentAnnotations = currentAnnotations.filter(a => a.id !== id);
  if (currentLibId) {
    await fetch(`/library/${currentLibId}/annotations/${id}`, { method: 'DELETE' }).catch(() => {});
  }
  renderAnnotations();
}

function markAnnotationInLayer(layer, text) {
  const short = text.slice(0, 20).toLowerCase();
  layer.querySelectorAll('span').forEach(s => {
    if (s.textContent.toLowerCase().includes(short)) s.classList.add('annotated');
  });
}

function renderAnnotations() {
  // Remove old annotations section
  sidebarBody.querySelector('.annots-section')?.remove();

  if (!currentAnnotations.length) return;

  const sec = document.createElement('div');
  sec.className = 'annots-section';
  sec.innerHTML = `<span class="annots-label">我的笔记（${currentAnnotations.length}）</span>` +
    currentAnnotations.map(a => `
      <div class="annot-item">
        <div class="annot-item-head">
          <div class="annot-item-quote page-ref-btn" data-page="${a.page}" style="cursor:pointer"
               title="${esc(pageLabel(a.page))}">${esc(a.text.slice(0, 60))}${a.text.length > 60 ? '…' : ''}</div>
          <button class="annot-item-del" data-action="del-annot" data-id="${a.id}">✕</button>
        </div>
        <div class="annot-item-note">${esc(a.note)}</div>
        <div class="annot-item-meta">${esc(pageLabel(a.page))} · ${esc(a.created_at)}</div>
      </div>`).join('');
  sidebarBody.appendChild(sec);
}

// ── Library ───────────────────────────────────────────────────────────────────

async function loadDocumentProfile(id, source = 'upload') {
  if (!id) return;
  try {
    const r = await fetch(`/document_profile/${id}?source=${source}`);
    if (!r.ok) return;
    const profile = await r.json();
    renderDocumentProfile(profile);
  } catch (_) {}
}

function renderDocumentProfile(profile) {
  if (!profile || structure) return;
  const c = ui().doc;
  const label = profile.reliability === 'high'
    ? c.high
    : profile.reliability === 'medium'
      ? c.medium
      : c.low;
  const ocr = profile.local_ocr?.available
    ? c.ocrYes
    : c.ocrNo;
  sidebarBody.innerHTML = `<div class="doc-health">
    <div class="doc-health-title">${esc(c.title)}</div>
    <span class="doc-health-badge ${profile.reliability}">${label}</span>
    <div class="doc-health-note">${esc(profile.recommendation || '')}</div>
    <div class="doc-health-grid">
      <div class="doc-health-stat"><b>${profile.page_count || 0}</b><span>${esc(c.pages)}</span></div>
      <div class="doc-health-stat"><b>${Math.round((profile.text_coverage || 0) * 100)}%</b><span>${esc(c.coverage)}</span></div>
      <div class="doc-health-stat"><b>${profile.scanned_pages || 0}</b><span>${esc(c.scanned)}</span></div>
      <div class="doc-health-stat"><b>${profile.image_count || 0}</b><span>${esc(c.images)}</span></div>
    </div>
    <div class="doc-health-note">${esc(ocr)}</div>
  </div>`;
}

// ── Settings helpers ──────────────────────────────────────────────────────────
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
  catch { return {}; }
}
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  // Bind the KnowKnow input character-counter listener (was a top-level
  // statement before the split; setupBattleListeners lives in battle.js).
  if (typeof setupBattleListeners === 'function') setupBattleListeners();

  // Initialize first tab
  const firstTab = makeTab();
  tabs.push(firstTab);
  activeTabId = firstTab.id;
  renderTabBar();

  const s = loadSettings();
  if (s.provider) providerSel.value = s.provider;
  if (s.apiKey)   apiKeyIn.value    = s.apiKey;
  if (s.model)    modelIn.value     = s.model;
  if (s.lang)     langSel.value = s.lang;
  if (s.maxChars) maxCharsIn.value = s.maxChars;
  updateHints();
  updateMaxCharsInfo();
  maxCharsIn.addEventListener('input', updateMaxCharsInfo);

  // Initialize UI language (independent of AI output language)
  const savedUiLang = localStorage.getItem('pr_ui_lang') || 'Chinese';
  setUiLang(savedUiLang);

  // Topbar
  fileInput.addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) handleFile(f);
  });
  analyzeBtn.addEventListener('click', handleAnalyze);
  settingsBtn.addEventListener('click', () => settingsOverlay.style.display = 'flex');
  settingsClose.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) closeSettings(); });
  saveBtn.addEventListener('click', handleSave);
  validateBtn.addEventListener('click', handleValidate);
  providerSel.addEventListener('change', () => { updateHints(); clearValidateResult(); });
  apiKeyIn.addEventListener('input', clearValidateResult);

  // Drop zone
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f && f.name.toLowerCase().endsWith('.pdf')) handleFile(f);
  });

  // Topbar language selector — controls UI language only, independent of AI output language
  topbarLangSel.addEventListener('change', () => {
    setUiLang(topbarLangSel.value);
  });

  // Language learning toggle
  learnLangBtn.addEventListener('click', () => {
    learnLang = !learnLang;
    learnLangBtn.classList.toggle('active', learnLang);
  });

  // Intent dialog
  intentClose.addEventListener('click', () => intentOverlay.style.display = 'none');
  intentOverlay.addEventListener('click', e => { if (e.target === intentOverlay) intentOverlay.style.display = 'none'; });
  intentOpts.addEventListener('click', e => {
    const opt = e.target.closest('.intent-opt');
    if (!opt) return;
    intentOpts.querySelectorAll('.intent-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    currentIntent = opt.dataset.intent;
    const needsInput = currentIntent === 'question' || currentIntent === 'research';
    intentQuestion.style.display = needsInput ? 'block' : 'none';
    intentQuestion.placeholder = currentIntent === 'research' ? ui().misc.researchPh : t('intent_question_ph');
    showIntentDesc(currentIntent);
  });
  intentOpts.addEventListener('mouseover', e => {
    const opt = e.target.closest('.intent-opt');
    if (opt) showIntentDesc(opt.dataset.intent);
  });
  intentOpts.addEventListener('mouseleave', () => showIntentDesc(currentIntent));
  intentConfirm.addEventListener('click', () => {
    // Mismatch warning: user picked output lang different from UI lang
    const outLang = $('intentLangSel').value;
    const uiLang  = topbarLangSel.value;
    if (outLang !== uiLang) {
      const msg = (t('mismatch') || '')
        .replace('{out}', LANG_DISPLAY[outLang] || outLang)
        .replace('{ui}',  LANG_DISPLAY[uiLang]  || uiLang);
      if (!confirm(msg)) return;
    }
    // Persist selected output lang so it sticks for next time
    const s = loadSettings();
    s.lang = outLang;
    saveSettings(s);

    currentQuestion = intentQuestion.value.trim();
    depth = INTENT_DEPTH[currentIntent] || 'brief';
    intentOverlay.style.display = 'none';
    doAnalyze();
  });

  // Annotation popup
  annotCancel.addEventListener('click', hideAnnotationPopup);
  annotSave.addEventListener('click', saveAnnotation);
  annotNote.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveAnnotation(); });
  document.addEventListener('mouseup', onTextSelected);
  document.addEventListener('mousedown', e => {
    if (annotPopup.classList.contains('show') && !annotPopup.contains(e.target)) hideAnnotationPopup();
    if (!selBar.contains(e.target)) hideSelBar();
  });

  // Selection toolbar
  selCopyBtn.addEventListener('click', () => {
    if (!_selText) return;
    navigator.clipboard.writeText(_selText).then(
      () => toast(t('toast_copied'), 'success'),
      () => { const ta = document.createElement('textarea'); ta.value = _selText; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast(t('toast_copied'), 'success'); }
    );
    hideSelBar();
  });
  selAnnotBtn.addEventListener('click', openAnnotPopupForSel);

  // PDF search bar
  pdfSearchInput.addEventListener('input', () => executeSearch(pdfSearchInput.value.trim()));
  pdfSearchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); if (_searchMatches.length) { _searchIdx = (_searchIdx + 1) % _searchMatches.length; navigateSearchMatch(); } }
    if (e.key === 'Escape') closePdfSearch();
  });
  pdfSearchPrev.addEventListener('click', () => { if (_searchIdx > 0) { _searchIdx--; navigateSearchMatch(); } });
  pdfSearchNext.addEventListener('click', () => { if (_searchIdx < _searchMatches.length - 1) { _searchIdx++; navigateSearchMatch(); } });
  pdfSearchClose.addEventListener('click', closePdfSearch);
  pdfSearchOcr.addEventListener('click', ocrScannedPages);

  // Ctrl+F / Cmd+F to open PDF search
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      if (pdfDoc) { e.preventDefault(); openPdfSearch(); }
    }
  });

  // Page-ref + citation click delegation
  sidebarBody.addEventListener('click', e => {
    const pageBtn = e.target.closest('.page-ref-btn');
    if (pageBtn) { const pg = parseInt(pageBtn.dataset.page); if (pg) goToPage(pg, pageBtn.dataset.hint || ''); return; }

    const copyBtn = e.target.closest('.cite-copy');
    if (copyBtn) {
      navigator.clipboard.writeText(copyBtn.dataset.q || '').then(
        () => toast(t('toast_copied'), 'success'),
        () => { /* clipboard denied — fallback */ const ta = document.createElement('textarea'); ta.value = copyBtn.dataset.q; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast(t('toast_copied'), 'success'); }
      );
      return;
    }

    const findBtn = e.target.closest('.cite-find');
    if (findBtn) { searchCitationInPDF(findBtn.dataset.q || ''); return; }

    const detailsToggle = e.target.closest('.details-toggle');
    if (detailsToggle) { toggleDetailsLayer(); return; }

    // Theme expand/collapse — guard against clicks on the editable heading
    if (e.target.closest('[data-stop-propagation]')) return;
    const themeHead = e.target.closest('[data-theme-toggle]');
    if (themeHead) { toggleTheme(themeHead.dataset.themeToggle); return; }

    // Data-action dispatcher (replaces inline onclick stripped by DOMPurify)
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      const a  = actionEl.dataset.action;
      const id = actionEl.dataset.id;
      // toggle-children sits inside sec-head — prevent both from firing
      if (a === 'toggle-children') { e.stopPropagation(); toggleChildren(id); return; }
      if (a === 'select-sec')      { selectSection(id, parseInt(actionEl.dataset.page)); return; }
      if (a === 'del-annot')       { deleteAnnotation(id); return; }
    }
  });

  // Library — event delegation for card actions
  libBody.addEventListener('click', e => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    e.stopPropagation();
    const a = actionEl.dataset.action;
    const id = actionEl.dataset.id;
    if (a === 'add-tag')  showTagInput(id);
    else if (a === 'load-lib') loadFromLibrary(id, actionEl.dataset.filename || '');
    else if (a === 'del-lib')  deleteLibraryItem(id);
  });

  // Library
  libraryBtn.addEventListener('click', openLibrary);
  libraryClose.addEventListener('click', () => libraryOverlay.style.display = 'none');
  libOrganizeBtn?.addEventListener('click', organizeLibrary);
  libExportBtn?.addEventListener('click', () => { window.location.href = '/library/export'; });
  libraryOverlay.addEventListener('click', e => { if (e.target === libraryOverlay) libraryOverlay.style.display = 'none'; });
  libSearch.addEventListener('input', () => renderLibraryItems(libAllItems, libSearch.value.trim()));

  // Scroll → update page badge
  pdfScroll.addEventListener('scroll', updateBadge, { passive: true });

  // Resize handle
  let isResizing = false;
  resizeHandle.addEventListener('mousedown', e => {
    isResizing = true;
    resizeHandle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!isResizing) return;
    const layout = sidebar.parentElement;
    const rect = layout.getBoundingClientRect();
    const newW = e.clientX - rect.left;
    sidebar.style.width = Math.max(260, Math.min(rect.width - 300, newW)) + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    resizeHandle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // Tab bar
  $('tabNewBtn').addEventListener('click', openNewTab);
  $('tabsList').addEventListener('click', e => {
    const closeBtn = e.target.closest('.tab-close');
    if (closeBtn) { closeTab(closeBtn.dataset.close); return; }
    const tab = e.target.closest('.tab');
    if (tab && tab.dataset.tab) switchToTab(tab.dataset.tab);
  });

  // Font size
  applyFontSize();
  fontDecBtn.addEventListener('click', () => { guideFontSize = Math.max(11, guideFontSize - 1); applyFontSize(); });
  fontIncBtn.addEventListener('click', () => { guideFontSize = Math.min(22, guideFontSize + 1); applyFontSize(); });
  $('exportBtn').addEventListener('click', exportNotes);
  pdfToMdBtn.addEventListener('click', downloadPdfAsMd);

  // Inline guide editing — debounced auto-save
  let editSaveTimer;
  sidebarBody.addEventListener('input', e => {
    if (!e.target.dataset.path) return;
    clearTimeout(editSaveTimer);
    editSaveTimer = setTimeout(saveGuideEdits, 1500);
  });
}

function applyFontSize() {
  sidebarBody.style.zoom = (guideFontSize / 14).toFixed(3);
  localStorage.setItem('pr_font_size', guideFontSize);
}

function closeSettings() {
  settingsOverlay.style.display = 'none';
  clearValidateResult();
}

function clearValidateResult() {
  validateResult.textContent = '';
  validateResult.className = 'validate-result';
}

async function handleValidate() {
  const key = apiKeyIn.value.trim();
  if (!key) { validateResult.textContent = t('validate_fill'); validateResult.className = 'validate-result err'; return; }
  validateBtn.disabled = true;
  validateBtn.textContent = t('validate_btn_ing');
  clearValidateResult();
  try {
    const endpoint = ['deepseek', 'groq', 'mistral'].includes(providerSel.value) ? '/validate_ext' : '/validate';
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerSel.value, api_key: key, model: modelIn.value }),
    });
    const data = await r.json();
    if (data.valid) {
      validateResult.textContent = data.warning
        ? '⚠ ' + data.warning
        : ui().settings.valid;
      validateResult.className = 'validate-result ok';
    } else {
      validateResult.textContent = '✗ ' + (data.error || t('validate_failed'));
      validateResult.className = 'validate-result err';
    }
  } catch {
    validateResult.textContent = '✗ ' + t('validate_server');
    validateResult.className = 'validate-result err';
  } finally {
    validateBtn.disabled = false;
    validateBtn.textContent = t('validate_btn');
  }
}

function updateMaxCharsInfo() {
  const c = ui().settings;
  const chars = parseInt(maxCharsIn.value);
  maxCharsLabel.firstChild.textContent = c.maxChars;
  maxCharsVal.textContent = chars.toLocaleString() + ' ' + c.chars;
  const pages = Math.round(chars / 2500);
  const tokensIn = Math.round(chars / 4);
  // output tokens vary by analysis type; ~8K–20K is typical
  const totalLow  = Math.round(tokensIn + 8000);
  const totalHigh = Math.round(tokensIn + 20000);
  const fmtLow  = totalLow  >= 1000 ? Math.round(totalLow  / 1000) + 'K' : totalLow;
  const fmtHigh = totalHigh >= 1000 ? Math.round(totalHigh / 1000) + 'K' : totalHigh;
  let warning = '';
  if (chars > 200000) warning = c.maxWarn;
  maxCharsInfo.textContent = fillVars(c.maxInfo, { pages, low: fmtLow, high: fmtHigh }) + warning;
}

function updateHints() {
  const p = providerSel.value;
  modelHints.innerHTML = (MODEL_HINTS[p] || '')
    .split('\n').map(h => `<div>${h}</div>`).join('');
}

function handleSave() {
  saveSettings({ provider: providerSel.value, apiKey: apiKeyIn.value, model: modelIn.value, lang: langSel.value, maxChars: parseInt(maxCharsIn.value) });
  closeSettings();
  toast(t('settings_saved'), 'success');
}

// ── File upload → render PDF ──────────────────────────────────────────────────

// ── PDF rendering ─────────────────────────────────────────────────────────────

// ── Navigate to page ──────────────────────────────────────────────────────────

// ── AI analysis ───────────────────────────────────────────────────────────────

// ── Render structure ──────────────────────────────────────────────────────────

// ── New guide renderer ────────────────────────────────────────────────────────

// ── Cognition Layer renderer ──────────────────────────────────────────

// ── Legacy tree renderer (for old library saves) ──────────────────────────────

// ── UI helpers ────────────────────────────────────────────────────────────────
function showLoading(msg) { loadingMsg.textContent = msg; loadingOverlay.style.display = 'flex'; }
function hideLoading()    { loadingOverlay.style.display = 'none'; }
function showAnalyzeStatus(msg) { analyzeStatusText.textContent = msg; analyzeStatus.style.display = 'flex'; }
function hideAnalyzeStatus()    { analyzeStatus.style.display = 'none'; }

var toastTimer;
function toast(msg, type = 'error') {
  clearTimeout(toastTimer);
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), 4000);
}

function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── KnowKnow paper dialogue panel ────────────────────────────────────────────

// ◀ — collapse to side handle; chat state preserved, click handle to expand

// 🦕 handle click — restore the panel

// Expose onclick handlers to global scope
window.selectSection     = selectSection;
window.toggleChildren    = toggleChildren;
window.toggleTheme       = toggleTheme;
window.goToPage          = goToPage;
window.loadFromLibrary   = loadFromLibrary;
window.deleteLibraryItem = deleteLibraryItem;
window.showTagInput      = showTagInput;
window.deleteAnnotation  = deleteAnnotation;
window.toggleBattlePanel  = toggleBattlePanel;
window.collapseBattlePanel = collapseBattlePanel;
window.expandBattlePanel   = expandBattlePanel;
window.selectBattleMode  = selectBattleMode;
window.battleStart       = battleStart;
window.battleSend        = battleSend;
window.battleAskHelp     = battleAskHelp;
window.battleEnd         = battleEnd;
window.battleReset       = battleReset;

init();
