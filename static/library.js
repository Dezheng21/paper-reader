/* PaperKnowKnow - library / shelf module.
 * Saves analyses to ~/library, lists/loads/deletes them,
 * organizes tags, and patches in-place inline edits.
 * Function declarations only - no top-level executable code.
 * Reads shared globals (set by app.js):
 *   fileId, currentFilename, currentLibId, structure, currentAnnotations,
 *   libAllItems, libSearch, libBody, libraryOverlay, libOrganizeBtn
 */

async function openLibrary() {
  libraryOverlay.style.display = 'flex';
  libSearch.value = '';
  libBody.innerHTML = `<div class="lib-empty"><div class="ei">⏳</div><span>${t('lib_loading')}</span></div>`;
  try {
    const r = await fetch('/library');
    libAllItems = await r.json();
    renderLibraryItems(libAllItems, '');
  } catch {
    libBody.innerHTML = `<div class="lib-empty"><div class="ei">⚠️</div><span>${t('lib_failed')}</span></div>`;
  }
}

async function organizeLibrary() {
  const c = ui().lib;
  if (!confirm(c.organizeConfirm)) return;
  const oldText = libOrganizeBtn?.textContent || c.organize;
  if (libOrganizeBtn) {
    libOrganizeBtn.disabled = true;
    libOrganizeBtn.textContent = c.organizing;
  }
  try {
    const r = await fetch('/library/organize', { method: 'POST' });
    if (!r.ok) throw new Error(c.organizeFailed);
    const data = await r.json();
    toast(fillVars(c.organizeDone, { scanned: data.scanned || 0, changed: data.changed || 0 }), 'success');
    const list = await fetch('/library');
    libAllItems = await list.json();
    renderLibraryItems(libAllItems, libSearch.value.trim());
  } catch (e) {
    toast(e.message || c.organizeFailed);
  } finally {
    if (libOrganizeBtn) {
      libOrganizeBtn.disabled = false;
      libOrganizeBtn.textContent = oldText;
    }
  }
}

function renderLibraryItems(items, query) {
  const c = ui().lib;
  const filtered = query
    ? items.filter(it =>
        (it.title || '').toLowerCase().includes(query.toLowerCase()) ||
        (it.filename || '').toLowerCase().includes(query.toLowerCase()) ||
        (it.authors || '').toLowerCase().includes(query.toLowerCase()) ||
        (it.analysis_method || '').toLowerCase().includes(query.toLowerCase()) ||
        (it.tags || []).some(t => t.toLowerCase().includes(query.toLowerCase()))
      )
    : items;

  if (!filtered.length) {
    const emptyMsg = query ? t('lib_no_match') : t('lib_empty');
    libBody.innerHTML = `<div class="lib-empty"><div class="ei">📭</div><span>${emptyMsg}</span></div>`;
    return;
  }

  libBody.innerHTML = filtered.map(it => {
    const tagsHTML = (it.tags || []).map(t => `<span class="lib-tag">${esc(t)}</span>`).join('');
    const date = it.saved_at ? it.saved_at.replace('T', ' ').slice(0, 16) : '';
    return `<div class="lib-card" data-id="${it.id}">
      <div class="lib-card-title">${esc(it.title || it.filename)}</div>
      <div class="lib-card-meta">${esc(it.authors || '')}${it.year ? ' · ' + esc(it.year) : ''}${it.analysis_method ? ' · ' + esc(it.analysis_method) : ''}${date ? ' · ' + c.savedAt + ' ' + date : ''}</div>
      <div class="lib-card-footer">
        <div class="lib-tags" id="tags_${it.id}">${tagsHTML}
          <span class="lib-add-tag" data-action="add-tag" data-id="${it.id}">${esc(c.addTag)}</span>
        </div>
        <div class="lib-card-actions">
          <button class="lib-btn lib-btn-load" data-action="load-lib" data-id="${it.id}" data-filename="${esc(it.filename)}">${esc(c.open)}</button>
          <button class="lib-btn lib-btn-del" data-action="del-lib" data-id="${it.id}">${esc(c.delete)}</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function showTagInput(libId) {
  const container = document.getElementById(`tags_${libId}`);
  if (container.querySelector('.lib-tag-input')) return;
  const addBtn = container.querySelector('.lib-add-tag');
  const inp = document.createElement('input');
  inp.className = 'lib-tag-input';
  inp.placeholder = ui().lib.tagPh;
  inp.onclick = e => e.stopPropagation();
  inp.onkeydown = async e => {
    if (e.key === 'Enter') {
      const val = inp.value.trim();
      if (val) await addTag(libId, val);
      inp.remove();
    } else if (e.key === 'Escape') {
      inp.remove();
    }
  };
  inp.onblur = () => setTimeout(() => inp.remove(), 200);
  container.insertBefore(inp, addBtn);
  inp.focus();
}

async function addTag(libId, tag) {
  const item = libAllItems.find(it => it.id === libId);
  if (!item) return;
  if (!(item.tags || []).includes(tag)) {
    item.tags = [...(item.tags || []), tag];
    await fetch(`/library/${libId}/tags`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: item.tags }),
    });
    renderLibraryItems(libAllItems, libSearch.value.trim());
  }
}

async function loadFromLibrary(libId, filename) {
  libraryOverlay.style.display = 'none';
  showLoading(ui().lib.loadingPaper);
  try {
    const [analysisResp, annotResp] = await Promise.all([
      fetch(`/library/${libId}/analysis`),
      fetch(`/library/${libId}/annotations`),
    ]);
    if (!analysisResp.ok) throw new Error(ui().lib.analysisLoadFailed);
    // Open new tab if current tab already has a PDF, otherwise reuse it
    { const at = getActiveTab(); if (at?.pdfUrl) { saveToTab(at); const nt = makeTab(filename); tabs.push(nt); activeTabId = nt.id; } else if (at) { at.filename = filename; } }
    structure = await analysisResp.json();
    currentAnnotations = annotResp.ok ? await annotResp.json() : [];
    currentLibId = libId;
    fileId = null;
    currentFilename = filename;
    filenameDisplay.textContent = filename;
    analyzeBtn.disabled = false; pdfToMdBtn.disabled = false;
    await renderPDF(`/library/${libId}/pdf`);
    renderStructure(structure);
    battleSetContext(structure);
    renderTabBar();
    toast(t('toast_lib_loaded'), 'success');
  } catch (e) {
    toast(t('toast_load_failed') + e.message);
  } finally {
    hideLoading();
  }
}

async function deleteLibraryItem(libId) {
  if (!confirm(ui().lib.deleteConfirm)) return;
  await fetch(`/library/${libId}`, { method: 'DELETE' });
  libAllItems = libAllItems.filter(it => it.id !== libId);
  renderLibraryItems(libAllItems, libSearch.value.trim());
  toast(t('toast_deleted'), 'success');
}

async function autoSaveToLibrary(analysis) {
  if (!currentFilename) return;
  // Decide PDF source: a fresh upload has fileId; a re-analysis of a paper
  // already in the library has currentLibId — pass source_lib_id so the
  // backend copies the PDF from that existing library entry.
  const body = { filename: currentFilename, analysis };
  if (fileId) {
    body.file_id = fileId;
  } else if (currentLibId) {
    body.source_lib_id = currentLibId;
  } else {
    return;  // no source — should not happen, but bail safely
  }
  try {
    const r = await fetch('/library/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    // Point the current tab at the NEW entry so subsequent edits target it,
    // not the old one (preserving the old entry intact in the library).
    currentLibId = data.id;
    { const tab = getActiveTab(); if (tab) tab.libId = data.id; }
    toast(t('toast_lib_saved'), 'success');
  } catch {
    // silent — saving is best-effort
  }
}

async function saveGuideEdits() {
  syncEditableToStructure();
  if (!currentLibId || !structure) return;
  await fetch(`/library/${currentLibId}/analysis`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analysis: structure }),
  }).catch(() => {});
}
