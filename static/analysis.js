/* PaperKnowKnow - analysis & guide-rendering module.
 * Owns intent selection, /analyze API, renderGuide (the big sidebar
 * renderer), overview dashboard, cognition layer, theme expand/collapse,
 * legacy tree, Markdown export.
 * Function declarations only - no top-level executable code.
 * Reads shared globals (set by app.js).
 */

const INTENT_DEPTH = { quick: 'brief', deep: 'detailed', question: 'detailed', deep_notes: 'deep', critical: 'detailed', research: 'detailed' };

const INTENT_DESCRIPTIONS = {
  quick: {
    title: '快速看懂',
    body: '把论文压缩成高信号解读：它问什么、回答什么、为什么重要。\n\n适合不一定读原文，先判断这篇论文值不值得深入。\n\n输出：核心问题 · 关键结论 · 3-5 个要点 · 最小阅读路径。',
  },
  deep: {
    title: '精读导读',
    body: '为精读原文做预热：先看清作者如何进入问题、怎样推进论证、哪些页面值得慢读。\n\n适合准备认真读原文、做课堂讨论或组会汇报前使用。\n\n输出：论证路线 · 关键转折 · 慢读页码 · 阅读提示。',
  },
  question: {
    title: '带问题读',
    body: '从你的具体问题出发，不做泛泛导读：先回答问题，再给论文证据，同时指出论文没有回答或无法证明的部分。\n\n适合已经知道自己想查什么，想让论文服务于某个问题的场景。',
  },
  deep_notes: {
    title: '文献笔记',
    body: '提取可保存、可复用的论文笔记：\n\n• 核心贡献\n• 问题意识与假设\n• 方法流程\n• 关键结果\n• 局限与未来研究。',
  },
  critical: {
    title: '审稿视角',
    body: '模拟公正但严格的审稿人：先承认贡献，再评估创新是否成立、证据链是否支撑结论、方法是否有硬伤。\n\n适合评估可信度、筛选综述材料。',
  },
  research: {
    title: '选题推进',
    body: '把这篇论文和你的研究课题接起来：找到可迁移的方法、未解决的空白、可操作的选题或实验方向。\n\n需要你输入自己的研究课题。',
  },
};

function applyIntentUi() {
  const c = ui();
  document.querySelectorAll('.intent-opt').forEach(opt => {
    const item = c.intents?.[opt.dataset.intent];
    if (!item) return;
    const title = opt.querySelector('.intent-opt-title');
    const desc = opt.querySelector('.intent-opt-desc');
    if (title) title.innerHTML = `${item.title} <span class="intent-opt-badge">${item.badge}</span>`;
    if (desc) desc.textContent = item.desc;
  });
  showIntentDesc(currentIntent);
}

function showIntentDesc(intent) {
  const d = ui().intents?.[intent] || INTENT_DESCRIPTIONS[intent];
  if (!d) { intentDesc.innerHTML = `<div class="tip-empty">${t('intent_tip')}</div>`; return; }
  intentDesc.innerHTML = `<div class="tip-title">${esc(d.title)}</div><div>${esc(d.body).replace(/\n/g, '<br>')}</div>`;
}

async function handleAnalyze() {
  if (!fileId && !currentLibId) { toast(t('toast_need_pdf')); return; }

  // Reset intent dialog state
  intentOpts.querySelectorAll('.intent-opt').forEach(o => o.classList.remove('selected'));
  intentOpts.querySelector('[data-intent="quick"]').classList.add('selected');
  currentIntent = 'quick';
  intentQuestion.value = '';
  intentQuestion.style.display = 'none';
  intentQuestion.placeholder = t('intent_question_ph');
  intentDesc.innerHTML = `<div class="tip-empty">${t('intent_tip')}</div>`;

  // Sync the output-lang select with last saved choice (defaults to UI lang)
  const ils = $('intentLangSel');
  if (ils) ils.value = loadSettings().lang || topbarLangSel.value || 'Chinese';

  intentOverlay.style.display = 'flex';
}

async function doAnalyze() {
  const s = loadSettings();
  if (!s.apiKey) {
    toast(t('toast_need_api_key2'));
    settingsOverlay.style.display = 'flex';
    return;
  }
  const provider = s.provider || 'claude';
  const DEFAULT_MODELS = {
    claude: 'claude-sonnet-4-6',
    openai: 'gpt-4o',
    gemini: 'gemini-2.5-flash',
    deepseek: 'deepseek-chat',
    groq: 'llama-3.3-70b-versatile',
    mistral: 'mistral-small-latest',
  };
  const modelName = s.model || DEFAULT_MODELS[provider] || provider;
  const analyzeTime = new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  // Use the active UI language's intent titles so the meta bar localizes
  const _intents = (ui().intents) || {};
  const INTENT_LABELS = {
    quick:      _intents.quick?.title      || 'Quick Read',
    deep:       _intents.deep?.title       || 'Close Reading Guide',
    question:   _intents.question?.title   || 'Question-led Reading',
    deep_notes: _intents.deep_notes?.title || 'Literature Notes',
    critical:   _intents.critical?.title   || 'Review Lens',
    research:   _intents.research?.title   || 'Research Direction',
  };

  showAnalyzeStatus(t('analyzing'));
  analyzeBtn.disabled = true; pdfToMdBtn.disabled = true;
  try {
    const r = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id:         fileId || '',
        lib_id:          currentLibId || '',
        provider,
        api_key:         s.apiKey,
        depth:           depth,
        model:           s.model || '',
        lang:            s.lang  || 'Chinese',
        intent:          currentIntent,
        learn_lang:      learnLang,
        intent_question: currentQuestion,
        max_chars:       s.maxChars || 100000,
      }),
    });
    if (!r.ok) {
      const detail = (await r.json()).detail || '分析失败';
      throw new Error(detail);
    }
    structure = await r.json();
    // Attach metadata (strip internal _usage, promote to _meta)
    const usage = structure._usage || {};
    delete structure._usage;
    structure._meta = {
      model:    modelName,
      provider,
      intent:   INTENT_LABELS[currentIntent] || currentIntent,
      question: currentQuestion || '',
      time:     analyzeTime,
      tokens:   usage.total || 0,
      input:    usage.input || 0,
      output:   usage.output || 0,
    };
    { const tab = getActiveTab(); if (tab) tab.structure = structure; }
    renderStructure(structure);
    // Every analysis becomes a separate library entry so users can keep
    // multiple analyses of the same paper (different intent / language / model).
    // PDF source: fresh upload uses file_id, re-analysis uses source_lib_id
    // (copies the PDF from the existing library entry).
    autoSaveToLibrary(structure);
    battleSetContext(structure);
  } catch (e) {
    toast(t('toast_analyze_failed') + e.message);
  } finally {
    hideAnalyzeStatus();
    analyzeBtn.disabled = !pdfDoc; pdfToMdBtn.disabled = !pdfDoc;
  }
}

function renderStructure(data) {
  // New guide format (has themes)
  if (data.themes) {
    renderGuide(data);
  } else if (data.sections) {
    renderLegacyTree(data);
  }
}

function evidenceBadge(item) {
  const status = item?.evidence_status || 'not_checked';
  const page   = item?.evidence_page || null;
  const suffix = page ? ` · ${pageLabel(page)}` : '';
  const label = status === 'verified'
    ? `${lab('verified')}${suffix}`
    : status === 'unverified'
      ? lab('unverified')
      : lab('notChecked');
  const note = item?.evidence_note ? ` title="${esc(item.evidence_note)}"` : '';
  // When the source is BOTH verified AND has a page number, make the whole
  // badge clickable. The `page-ref-btn` class is recognized by the sidebar
  // click-delegation in app.js, which routes to goToPage(page, hint) — the
  // same destination as the "PDF 定位" button. The quote (if present) is
  // passed as the hint so the PDF viewer can also highlight the matching
  // text after jumping. When no page exists we fall back to a bare span.
  if (status === 'verified' && page) {
    const hint = esc(item?.quote || item?.text_hint || '');
    return `<span class="evidence-badge ${status} page-ref-btn"${note} data-page="${page}" data-hint="${hint}" style="cursor:pointer">${label}</span>`;
  }
  return `<span class="evidence-badge ${status}"${note}>${label}</span>`;
}

function evidenceClass(item) {
  const status = item?.evidence_status || '';
  return status ? ` ${status}` : '';
}

function normalizeCitationItem(item) {
  if (typeof item === 'string') return { quote: item };
  if (!item) return { quote: '' };
  return { ...item, quote: item.quote || item.text || item.citation || '' };
}

function _shortText(s, n = 86) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function buildVisualOverview(data) {
  const themes = (data.themes || []).slice(0, 5);
  const firstTheme = themes[0] || {};
  const middleTheme = themes[Math.min(1, Math.max(0, themes.length - 1))] || firstTheme;
  const lastTheme = themes[themes.length - 1] || firstTheme;

  const logicSteps = data.visual_summary?.logic_steps || [
    { label: lab('problem'), text: data.core_question || firstTheme.heading || '' },
    { label: lab('method'), text: data.methodology_flow || middleTheme.heading || '' },
    { label: lab('finding'), text: data.key_insight || firstTheme.highlight || firstTheme.narrative || '' },
    { label: lab('conclusion'), text: data.skeptics_note || lastTheme.highlight || lastTheme.heading || '' },
  ];

  const evidenceChain = data.visual_summary?.evidence_chain || themes.map(t => {
    const refs = t.page_refs || [];
    const c = normalizeCitationItem((t.citations || [])[0]);
    const status = c.evidence_status || refs[0]?.evidence_status || 'not_checked';
    return {
      claim: t.highlight || t.heading || t.narrative || '',
      status,
      page: c.evidence_page || refs[0]?.evidence_page || refs[0]?.page || '',
    };
  }).filter(x => x.claim).slice(0, 5);

  const conceptMapRaw = data.visual_summary?.concept_map || themes
    .map(t => t.heading)
    .filter(Boolean)
    .slice(0, 8);
  const conceptMap = conceptMapRaw.map(c => typeof c === 'string'
    ? c
    : `${c.from || ''}${c.relation ? ' → ' + c.relation : ''}${c.to ? ' → ' + c.to : ''}`.trim()
  ).filter(Boolean);

  return { logicSteps, evidenceChain, conceptMap };
}

function renderModeSpecificOverview(data) {
  const intent = data._meta?.intent || data.analysis_method || '';
  const str = v => {
    if (!v && v !== 0) return '';
    if (typeof v === 'string') return v;
    return v.text || v.content || v.description || v.finding || v.point || JSON.stringify(v);
  };
  if (intent.includes('文献笔记')) {
    const contrib = (data.contributions || []).slice(0, 3).map(str).filter(Boolean);
    const results = (data.key_results || []).slice(0, 3).map(r => str(r.finding || r.result || r)).filter(Boolean);
    return `<div class="ov-card ov-card-wide"><div class="ov-label">${lab('modeLiterature')}</div>
      <div class="concept-chips">${contrib.map(c => `<span class="concept-chip">${esc(_shortText(c, 34))}</span>`).join('') || `<span class="concept-chip">${lab('noConcepts')}</span>`}</div>
      ${data.methodology_flow ? `<div class="ov-text" style="margin-top:8px"><b>${lab('researchMethod')}：</b>${esc(_shortText(str(data.methodology_flow), 130))}</div>` : ''}
      ${results.length ? `<div class="ov-text" style="margin-top:6px"><b>${lab('keyResults')}：</b>${esc(results.map(r => _shortText(r, 36)).join('；'))}</div>` : ''}
    </div>`;
  }
  if (intent.includes('审稿视角')) {
    const issues = (data.methodology_issues || []).slice(0, 3).map(i => i.issue || i.detail || '').filter(Boolean);
    const fatal = (data.fatal_weaknesses || []).slice(0, 2).map(w => w.weakness || '').filter(Boolean);
    return `<div class="ov-card ov-card-wide"><div class="ov-label">${lab('modeReview')}</div>
      <div class="ov-text"><b>${lab('innovationEval')}：</b>${esc(data.innovation_verdict || '')}</div>
      ${data.innovation_analysis ? `<div class="ov-text" style="margin-top:6px">${esc(_shortText(data.innovation_analysis, 150))}</div>` : ''}
      ${issues.length ? `<div class="ov-text" style="margin-top:6px"><b>${lab('methodIssues')}：</b>${esc(issues.join('；'))}</div>` : ''}
      ${fatal.length ? `<div class="ov-text" style="margin-top:6px"><b>${lab('hardWeaknesses')}：</b>${esc(fatal.join('；'))}</div>` : ''}
    </div>`;
  }
  if (intent.includes('研究推进') || intent.includes('选题推进')) {
    const gaps = (data.research_gaps || []).slice(0, 3).map(str).filter(Boolean);
    const ideas = (data.experiment_ideas || []).slice(0, 3).map(i => i.name || i.hypothesis || '').filter(Boolean);
    return `<div class="ov-card ov-card-wide"><div class="ov-label">${lab('modeResearch')}</div>
      ${data.transfer_analysis ? `<div class="ov-text"><b>${lab('transfer')}：</b>${esc(_shortText(data.transfer_analysis, 150))}</div>` : ''}
      ${gaps.length ? `<div class="ov-text" style="margin-top:6px"><b>${lab('gaps')}：</b>${esc(gaps.map(g => _shortText(g, 36)).join('；'))}</div>` : ''}
      ${ideas.length ? `<div class="concept-chips" style="margin-top:8px">${ideas.map(i => `<span class="concept-chip">${esc(_shortText(i, 30))}</span>`).join('')}</div>` : ''}
    </div>`;
  }
  if (intent.includes('带问题阅读') || intent.includes('带问题读')) {
    return `<div class="ov-card ov-card-wide"><div class="ov-label">${lab('modeQuestion')}</div><div class="ov-text">${ui().intents.question.desc}</div></div>`;
  }
  if (intent.includes('精读导航') || intent.includes('精读导读')) {
    return `<div class="ov-card ov-card-wide"><div class="ov-label">${lab('modeDeep')}</div><div class="ov-text">${ui().intents.deep.desc}</div></div>`;
  }
  return '';
}

function renderOverviewDashboard(data) {
  const ov = buildVisualOverview(data);
  const intent = data._meta?.intent || data.analysis_method || '未标注';
  const logicHTML = ov.logicSteps.map(step => `<div class="logic-step">
    <div class="logic-step-label">${esc(step.label || '')}</div>
    <div class="logic-step-text">${esc(_shortText(step.text, 120))}</div>
  </div>`).join('');

  const evidenceHTML = ov.evidenceChain.map(row => {
    const badge = evidenceBadge({ evidence_status: row.status || 'not_checked', evidence_page: row.page || null });
    return `<div class="evidence-row">
      <div class="evidence-claim">${esc(_shortText(row.claim, 88))}</div>
      ${badge}
    </div>`;
  }).join('');

  const conceptsHTML = ov.conceptMap.length
    ? ov.conceptMap.map(c => `<span class="concept-chip">${esc(_shortText(c, 26))}</span>`).join('')
    : `<span class="concept-chip">${lab('noConcepts')}</span>`;

  const sep = _uiLang === 'ja' || _uiLang === 'zh' || _uiLang === 'zh-TW' || _uiLang === 'ko' ? '、' : ', ';
  const readMapHTML = (data.read_this_if || []).slice(0, 3).map(p => {
    const locs = p.locations
      ? p.locations.map(l => pageLabel(l.page)).join(sep)
      : (p.pages || []).map(pg => pageLabel(pg)).join(sep);
    return `<div class="read-map-item"><span class="read-map-goal">${esc(p.goal || '')}</span><span>${esc(locs || '')}</span></div>`;
  }).join('');

  return `<div class="overview-dashboard">
    <div class="ov-grid">
      <div class="ov-card">
        <div class="ov-label">${lab('coreQuestion')}</div>
        <div class="ov-text">${esc(_shortText(data.core_question, 120))}</div>
      </div>
      <div class="ov-card">
        <div class="ov-label">${lab('coreConclusion')}</div>
        <div class="ov-text">${esc(_shortText(data.key_insight, 120))}</div>
      </div>
      <div class="ov-card ov-card-wide">
        <div class="ov-label">${lab('argumentRoute')}</div>
        <div class="logic-flow">${logicHTML}</div>
      </div>
      <div class="ov-card ov-card-wide">
        <div class="ov-label">${lab('evidenceChain')}</div>
        <div class="evidence-chain">${evidenceHTML || `<div class="ov-text">${lab('noEvidence')}</div>`}</div>
      </div>
      <div class="ov-card">
        <div class="ov-label">${lab('conceptNodes')}</div>
        <div class="concept-chips">${conceptsHTML}</div>
      </div>
      <div class="ov-card">
        <div class="ov-label">${lab('readingPath')}</div>
        <div class="read-map-mini">${readMapHTML || `<div class="ov-text">${lab('noReadingPath')}</div>`}</div>
      </div>
      ${renderModeSpecificOverview(data)}
    </div>
  </div>`;
}

function renderGuide(data) {
  let html = '';

  // Paper header
  html += `<div class="guide-paper-info">
    <div class="guide-paper-title">${esc(data.title || lab('unknownTitle'))}</div>
    <div class="guide-paper-meta">${esc(data.authors || '')}${data.year ? ' · ' + esc(data.year) : ''}</div>
  </div>`;

  // Analysis metadata bar — moved to top (between author & body), always visible
  if (data._meta) {
    const m = data._meta;
    const tokStr = m.tokens ? `${m.tokens.toLocaleString()} tokens` : '';
    const detailStr = (m.input && m.output) ? ` (↑${m.input.toLocaleString()} ↓${m.output.toLocaleString()})` : '';
    html += `<div class="analysis-meta">
      <span><span class="analysis-meta-star">★</span>${esc(m.model)}</span>
      <span class="sep">·</span>
      <span>${esc(m.intent)}</span>
      <span class="sep">·</span>
      <span>${esc(m.time)}</span>
      ${tokStr ? `<span class="sep">·</span><span title="输入 ${m.input?.toLocaleString() || 0} + 输出 ${m.output?.toLocaleString() || 0}">${tokStr}${detailStr}</span>` : ''}
    </div>`;
  }

  // String-coercion helper for AI fields that might come back as objects.
  // Declared early because the moved research-method / key-results blocks
  // below also use it (they were originally inside the deep_notes section).
  const _str = v => {
    if (!v && v !== 0) return '';
    if (typeof v === 'string') return v;
    return v.text || v.content || v.description || v.contribution || v.finding || v.point || JSON.stringify(v);
  };

  // ── Cognition Layer (认知层) — visual anchor ──────────────────────
  html += renderCognitionLayer(data);

  // ── Research Method & Key Results — promoted to the top so they sit
  //    ABOVE the collapsed details layer and become the first substantive
  //    blocks the reader sees after the cognition anchor.
  if (data.methodology_flow) {
    html += `<div class="mode-section"><span class="section-label">${lab('researchMethod')}</span>
      <div class="methodology-text" contenteditable="true" data-path="methodology_flow">${esc(_str(data.methodology_flow))}</div></div>`;
  }
  if (data.key_results?.length) {
    html += `<div class="mode-section"><span class="section-label">${lab('keyResults')}</span>` +
      data.key_results.map(r => {
        if (typeof r === 'string') return `<div class="result-item"><div class="result-finding">${esc(r)}</div></div>`;
        const finding = _str(r.finding || r.result || r.description || r);
        const dv      = _str(r.data   || r.value  || r.numbers || '');
        const comp    = _str(r.comparison || r.vs  || r.baseline || '');
        return `<div class="result-item">
          <div class="result-finding">${esc(finding)}</div>
          ${dv   ? `<div class="result-data">${esc(dv)}</div>` : ''}
          ${comp ? `<div class="result-comp">对比：${esc(comp)}</div>` : ''}
        </div>`;
      }).join('') + `</div>`;
  }

  // Toggle: collapse/expand the details below
  html += `<div class="details-toggle">
    <span class="details-toggle-text" id="detailsToggleText">${esc(t('expand_full'))}</span>
    <span class="details-toggle-icon" id="detailsToggleIcon">▾</span>
  </div>`;

  html += `<div class="details-layer collapsed" id="detailsLayer">`;
  html += renderOverviewDashboard(data);

  if (data._evidence && data._evidence.checked) {
    const ev = data._evidence;
    html += `<div class="evidence-summary">
      ${lab('evidenceCheck')}：✓ ${ev.verified || 0} ${lab('found')}
      ${ev.unverified ? ` · ⚠ ${ev.unverified} ${lab('notFound')}` : ''}
      ${ev.not_checked ? ` · ○ ${ev.not_checked} ${lab('unchecked')}` : ''}
      ${ev.extracted_chars < 200 ? `<br>${lab('scannedWarn')}` : ''}
    </div>`;
  }

  // Core question
  if (data.core_question) {
    html += `<div class="core-question" contenteditable="true" data-path="core_question">${esc(data.core_question)}</div>`;
  }

  // Key insight
  if (data.key_insight) {
    html += `<div class="key-insight">
      <span class="key-insight-label">${lab('keyInsight')}</span>
      <div contenteditable="true" data-path="key_insight">${esc(data.key_insight)}</div>
    </div>`;
  }

  // Guide intro
  if (data.guide_intro) {
    html += `<div class="guide-intro" contenteditable="true" data-path="guide_intro">${esc(data.guide_intro)}</div>`;
  }

  // Themes
  if (data.themes && data.themes.length) {
    html += `<div class="themes-section">`;
    data.themes.forEach(theme => {
      const refsHTML = (theme.page_refs || []).map(r =>
        `<button class="page-ref-btn${evidenceClass(r)}" data-page="${r.page}" data-hint="${esc(r.text_hint || '')}" title="${esc(r.evidence_note || r.text_hint || '')}">${pageLabel(r.page)}${r.label ? ' · ' + esc(r.label) : ''}</button>`
      ).join('');

      const citesHTML = (theme.citations || []).map(raw => {
        const c = normalizeCitationItem(raw);
        const q = c.quote || '';
        return `<div class="citation-item">
          <span class="citation-text">${esc(q)}</span>
          ${evidenceBadge(c)}
          <div class="citation-actions">
            <button class="cite-btn cite-copy" data-q="${esc(q)}">${esc(t('copy'))}</button>
            <button class="cite-btn cite-find" data-q="${esc(q)}" data-page="${c.evidence_page || ''}" data-hint="${esc(c.text_hint || c.quote || '')}" data-snippet="${esc(c.quote || '')}">${esc(t('pdf_locate'))}</button>
          </div>
        </div>`;
      }).join('');

      html += `<div class="theme-item" data-id="${theme.id}">
        <div class="theme-head" data-theme-toggle="${theme.id}">
          <div class="theme-toggle" id="ttog_${theme.id}">▶</div>
          <div class="theme-text">
            <span class="theme-heading" contenteditable="true" data-path="theme.${theme.id}.heading" data-stop-propagation="1">${esc(theme.heading)}</span>
          </div>
        </div>
        <div class="theme-body" id="tbody_${theme.id}">
          ${theme.narrative ? `<div class="theme-narrative" contenteditable="true" data-path="theme.${theme.id}.narrative">${esc(theme.narrative)}</div>` : ''}
          ${theme.highlight ? `<div class="theme-highlight" contenteditable="true" data-path="theme.${theme.id}.highlight">${esc(theme.highlight)}</div>` : ''}
          ${refsHTML ? `<div class="page-refs">${refsHTML}</div>` : ''}
          ${citesHTML ? `<div class="citations-list">${citesHTML}</div>` : ''}
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  // Skeptic's note
  if (data.skeptics_note) {
    html += `<div class="skeptics-note">
      <span class="skeptics-label">${lab('worthNoting')}</span>
      <div contenteditable="true" data-path="skeptics_note">${esc(data.skeptics_note)}</div>
    </div>`;
  }

  // Key citations (global)
  if (data.key_citations?.length) {
    html += `<div class="mode-section" style="margin:8px 14px 0"><span class="section-label">${lab('keyQuotes')}</span>
      <div class="citations-list">${data.key_citations.map(c => {
        const ci = normalizeCitationItem(c);
        const q = ci.quote || '';
        const lbl = typeof c === 'string' ? '' : (c.label || '');
        return `<div class="citation-item">
          ${lbl ? `<span class="citation-label">${esc(lbl)}</span>` : ''}
          <span class="citation-text">${esc(q)}</span>
          ${evidenceBadge(ci)}
          <div class="citation-actions">
            <button class="cite-btn cite-copy" data-q="${esc(q)}">${esc(t('copy'))}</button>
            <button class="cite-btn cite-find" data-q="${esc(q)}" data-page="${ci.evidence_page || ''}" data-hint="${esc(ci.text_hint || ci.quote || '')}" data-snippet="${esc(ci.quote || '')}">${esc(t('pdf_locate'))}</button>
          </div>
        </div>`;
      }).join('')}
      </div>
    </div>`;
  }

  // Reading paths
  if (data.read_this_if && data.read_this_if.length) {
    html += `<div class="read-paths">
      <div class="read-paths-label">${lab('readingAdvice')}</div>`;
    data.read_this_if.forEach(path => {
      // Support new locations format and old pages format
      let locsHTML = '';
      if (path.locations && path.locations.length) {
        locsHTML = path.locations.map(loc =>
          `<span class="read-path-page page-ref-btn" data-page="${loc.page}" data-hint="${esc(loc.hint || '')}">${pageLabel(loc.page)}${loc.lines ? ' · ' + linesLabel(loc.lines) : ''}</span>`
        ).join('');
      } else if (path.pages && path.pages.length) {
        locsHTML = path.pages.map(p =>
          `<span class="read-path-page page-ref-btn" data-page="${p}">${pageLabel(p)}</span>`
        ).join('');
      }
      html += `<div class="read-path-item">
        <div class="read-path-goal">${esc(path.goal)}</div>
        <div class="read-path-pages">${locsHTML}</div>
      </div>`;
    });
    html += `</div>`;
  }

  // Vocab cards — language-learning mode only. We require BOTH conditions:
  //   1) the user has the "语言学习 / Lang Learning" toggle ON (`learnLang`)
  //   2) the AI actually returned `key_terms` and the array is non-empty
  // Otherwise we skip rendering the container entirely (no empty placeholder).
  if (learnLang && data.key_terms && data.key_terms.length) {
    html += `<div class="vocab-section">
      <span class="vocab-section-label">${lab('vocab')}</span>`;
    data.key_terms.forEach(term => {
      html += `<div class="vocab-card">
        <div class="vocab-original">${esc(term.original)}</div>
        <div class="vocab-translation">${esc(term.translation)}</div>
        <div class="vocab-def">${esc(term.definition)}</div>
        ${term.page ? `<button class="page-ref-btn" data-page="${term.page}">${pageLabel(term.page)}</button>` : ''}
      </div>`;
    });
    html += `</div>`;
  }

  // ── deep_notes extra sections ──
  // Note: `_str` helper, `researchMethod`, and `keyResults` blocks have been
  // moved to the top of renderGuide (above the details-toggle) so the reader
  // sees them first. Only contributions/limits/etc remain in the collapsed
  // details layer.
  if (data.contributions?.length) {
    html += `<div class="mode-section"><span class="section-label">${lab('contributions')}</span>
      <ul class="contributions-list">${data.contributions.map(c => `<li contenteditable="true">${esc(_str(c))}</li>`).join('')}</ul></div>`;
  }
  if (data.limitations_future) {
    const lf = data.limitations_future;
    html += `<div class="mode-section"><span class="section-label">${lab('limitsFuture')}</span>
      ${lf.author_admits ? `<div class="issue-item"><div class="issue-title">${lab('authorAdmits')}</div><div class="issue-detail" contenteditable="true" data-path="lf_author">${esc(lf.author_admits)}</div></div>` : ''}
      ${lf.expert_critique ? `<div class="issue-item"><div class="issue-title">${lab('blindSpot')}</div><div class="issue-detail" contenteditable="true" data-path="lf_expert">${esc(lf.expert_critique)}</div></div>` : ''}
    </div>`;
  }

  // ── critical extra sections ──
  if (data.innovation_verdict) {
    const vc = data.innovation_verdict.includes('真正') ? 'verdict-good' : data.innovation_verdict.includes('增量') ? 'verdict-mid' : 'verdict-bad';
    html += `<div class="mode-section"><span class="section-label">${lab('innovationEval')}</span>
      <div class="innovation-verdict ${vc}">${esc(data.innovation_verdict)}</div>
      ${data.innovation_analysis ? `<div class="issue-detail" contenteditable="true" data-path="innovation_analysis">${esc(data.innovation_analysis)}</div>` : ''}
    </div>`;
  }
  if (data.methodology_issues?.length) {
    html += `<div class="mode-section"><span class="section-label">${lab('methodIssues')}</span>` +
      data.methodology_issues.map(i => `<div class="issue-item">
        <div class="issue-title">${esc(i.issue)}</div>
        <div class="issue-detail">${esc(i.detail)}</div>
      </div>`).join('') + `</div>`;
  }
  if (data.fatal_weaknesses?.length) {
    html += `<div class="mode-section"><span class="section-label">${lab('hardWeaknesses')}</span>` +
      data.fatal_weaknesses.map(w => `<div class="fatal-item">
        <div class="fatal-weakness">${esc(w.weakness)}</div>
        ${w.impact ? `<div class="fatal-impact">${esc(w.impact)}</div>` : ''}
      </div>`).join('') + `</div>`;
  }
  if (data.citation_note) {
    html += `<div class="mode-section"><span class="section-label">${lab('citationAdvice')}</span>
      <div class="citation-box" contenteditable="true" data-path="citation_note">${esc(data.citation_note)}</div></div>`;
  }

  // ── research extra sections ──
  if (data.transfer_analysis) {
    html += `<div class="mode-section"><span class="section-label">${lab('transfer')}</span>
      <div class="methodology-text" contenteditable="true" data-path="transfer_analysis">${esc(data.transfer_analysis)}</div></div>`;
  }
  if (data.research_gaps?.length) {
    html += `<div class="mode-section"><span class="section-label">${lab('gaps')}</span>` +
      data.research_gaps.map(g => `<div class="gap-item">${esc(g)}</div>`).join('') + `</div>`;
  }
  if (data.experiment_ideas?.length) {
    html += `<div class="mode-section"><span class="section-label">${lab('experimentIdeas')}</span>` +
      data.experiment_ideas.map(idea => `<div class="idea-item">
        <div class="idea-name">💡 ${esc(idea.name)}</div>
        <div class="idea-hypothesis">${esc(idea.hypothesis)}</div>
        <div class="idea-challenges">⚠ ${esc(idea.challenges)}</div>
      </div>`).join('') + `</div>`;
  }
  if (data.ref_keywords?.length) {
    html += `<div class="mode-section"><span class="section-label">${lab('furtherKeywords')}</span>
      <div class="ref-keywords">${data.ref_keywords.map(k => `<span class="ref-tag">${esc(k)}</span>`).join('')}</div></div>`;
  }

  html += `</div>`;  // close .details-layer

  sidebarBody.innerHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html) : html;
  renderAnnotations();
}

function renderCognitionLayer(data) {
  const thesis = data.one_line_thesis || '';
  const pillars = Array.isArray(data.three_pillars) ? data.three_pillars : [];
  const shortcut = data.reading_shortcut || '';
  if (!thesis && !pillars.length && !shortcut) return '';

  let html = `<div class="cognition-layer">`;

  if (thesis) {
    html += `<div class="cog-thesis" contenteditable="true" data-path="one_line_thesis">${esc(thesis)}</div>`;
  }

  if (pillars.length) {
    html += `<div class="cog-pillars">`;
    pillars.forEach((p, i) => {
      const label = p.label || ['为什么重要', '怎么知道的', '所以呢'][i] || '';
      const text  = p.text || '';
      html += `<div class="cog-pillar">
        <div class="cog-pillar-label">${esc(label)}</div>
        <div class="cog-pillar-text">${esc(text)}</div>
      </div>`;
    });
    html += `</div>`;
  }

  if (shortcut) {
    html += `<div class="cog-shortcut">
      <span class="cog-shortcut-icon">💡</span>
      <span class="cog-shortcut-text">${esc(shortcut)}</span>
    </div>`;
  }

  html += `</div>`;
  return html;
}

function toggleDetailsLayer() {
  const layer = document.getElementById('detailsLayer');
  const text  = document.getElementById('detailsToggleText');
  const icon  = document.getElementById('detailsToggleIcon');
  if (!layer) return;
  const isCollapsed = layer.classList.toggle('collapsed');
  if (text) text.textContent = isCollapsed ? t('expand_full') : t('collapse_full');
  if (icon) icon.textContent = isCollapsed ? '▾' : '▴';
}

function toggleTheme(id) {
  const body = document.getElementById(`tbody_${id}`);
  const tog  = document.getElementById(`ttog_${id}`);
  const item = tog ? tog.closest('.theme-item') : null;
  if (body) body.classList.toggle('open');
  if (tog)  tog.classList.toggle('open');
  if (item) item.classList.toggle('active');
}

function renderLegacyTree(data) {
  let html = '';
  html += `<div class="paper-info">
    <div class="paper-title-sb">${esc(data.title || '未知标题')}</div>
    <div class="paper-meta">${esc(data.authors || '')}${data.year ? ' · ' + esc(data.year) : ''}</div>
    ${data.abstract_summary ? `<div class="abs-box">${esc(data.abstract_summary)}</div>` : ''}
  </div>`;

  function buildSection(sec) {
    const hasSubs = sec.subsections && sec.subsections.length > 0;
    const summaryText = sec.detailed_summary || sec.brief_summary || '';
    const kfItems = sec.key_findings || [];
    const summaryHTML = summaryText || kfItems.length
      ? `<div class="sec-summary open" id="sum_${sec.id}">
           ${esc(summaryText)}
           ${kfItems.length ? `<ul class="kf-list">${kfItems.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
         </div>` : '';
    const childrenHTML = hasSubs
      ? `<div class="sec-children open" id="ch_${sec.id}">${sec.subsections.map(buildSection).join('')}</div>` : '';
    return `<div class="sec-item" data-level="${sec.level}" data-id="${sec.id}" data-page="${sec.page}">
      <div class="sec-head" data-action="select-sec" data-id="${sec.id}" data-page="${sec.page}">
        <div class="toggle-icon ${hasSubs ? 'open' : 'leaf'}" id="tog_${sec.id}"
             data-action="toggle-children" data-id="${sec.id}">${hasSubs ? '▶' : ''}</div>
        <div class="sec-text">
          <span class="sec-title">${esc(sec.title)}</span>
          <span class="sec-page">${pageLabel(sec.page)}</span>
        </div>
      </div>
      ${summaryHTML}${childrenHTML}
    </div>`;
  }

  html += data.sections.map(buildSection).join('');
  sidebarBody.innerHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html) : html;
  renderAnnotations();
}

function selectSection(id, page) {
  goToPage(page);
  document.querySelectorAll('.sec-item').forEach(el => el.classList.remove('active'));
  const item = document.querySelector(`.sec-item[data-id="${id}"]`);
  if (item) item.classList.add('active');
  const sum = document.getElementById(`sum_${id}`);
  if (sum) sum.classList.toggle('open');
}

function toggleChildren(id) {
  const ch  = document.getElementById(`ch_${id}`);
  const tog = document.getElementById(`tog_${id}`);
  if (ch)  ch.classList.toggle('open');
  if (tog) tog.classList.toggle('open');
}

function exportNotes() {
  if (!structure) { toast(t('toast_export_first')); return; }
  const d = structure;
  const lines = [];
  const nl = s => lines.push(s);

  // Header
  nl(`# ${d.title || currentFilename || '未知论文'}`);
  if (d.authors || d.year) nl(`**${[d.authors, d.year].filter(Boolean).join(' · ')}**`);
  nl('');

  // Core question
  if (d.core_question) { nl('## 核心问题'); nl(''); nl(`> ${d.core_question}`); nl(''); }

  // Key insight
  if (d.key_insight) { nl('## 核心发现'); nl(''); nl(d.key_insight); nl(''); }

  // Guide intro
  if (d.guide_intro) { nl('## 分析导语'); nl(''); nl(d.guide_intro); nl(''); }

  // Themes
  if (d.themes?.length) {
    nl('## 主题分析'); nl('');
    d.themes.forEach(t => {
      nl(`### ${t.heading}`);
      if (t.narrative) nl(t.narrative);
      if (t.highlight) nl(`\n> ${t.highlight}`);
      if (t.page_refs?.length) nl('\n' + t.page_refs.map(r => pageLabel(r.page)).join('、'));
      nl('');
    });
  }

  // Skeptics note
  if (d.skeptics_note) { nl('## 值得留意'); nl(''); nl(d.skeptics_note); nl(''); }

  // deep_notes extras
  if (d.contributions?.length) {
    nl('## 核心贡献'); nl('');
    d.contributions.forEach(c => nl(`- ${typeof c === 'string' ? c : JSON.stringify(c)}`));
    nl('');
  }
  if (d.methodology_flow) { nl('## 研究方法'); nl(''); nl(typeof d.methodology_flow === 'string' ? d.methodology_flow : JSON.stringify(d.methodology_flow)); nl(''); }
  if (d.key_results?.length) {
    nl('## 关键结果'); nl('');
    d.key_results.forEach(r => {
      const f = typeof r === 'string' ? r : (r.finding || r.result || '');
      const dv = typeof r === 'string' ? '' : (r.data || r.value || '');
      const comp = typeof r === 'string' ? '' : (r.comparison || r.vs || '');
      nl(`- ${f}${dv ? '  \n  数据：' + dv : ''}${comp ? '  \n  对比：' + comp : ''}`);
    });
    nl('');
  }
  if (d.limitations_future) {
    nl('## 局限与未来方向'); nl('');
    if (d.limitations_future.author_admits) nl(`**作者承认：** ${d.limitations_future.author_admits}`);
    if (d.limitations_future.expert_critique) nl(`**潜在盲点：** ${d.limitations_future.expert_critique}`);
    nl('');
  }

  // critical extras
  if (d.innovation_verdict) { nl('## 创新性评估'); nl(''); nl(`**结论：** ${d.innovation_verdict}`); if (d.innovation_analysis) nl(d.innovation_analysis); nl(''); }
  if (d.fatal_weaknesses?.length) {
    nl('## 主要硬伤'); nl('');
    d.fatal_weaknesses.forEach(w => nl(`- **${w.weakness}**${w.impact ? '  \n  ' + w.impact : ''}`));
    nl('');
  }
  if (d.citation_note) { nl('## 引用建议'); nl(''); nl(d.citation_note); nl(''); }

  // research extras
  if (d.transfer_analysis) { nl('## 方法迁移分析'); nl(''); nl(d.transfer_analysis); nl(''); }
  if (d.research_gaps?.length) { nl('## 研究空白'); nl(''); d.research_gaps.forEach(g => nl(`- ${g}`)); nl(''); }
  if (d.experiment_ideas?.length) {
    nl('## 实验方向'); nl('');
    d.experiment_ideas.forEach(i => {
      nl(`### 💡 ${i.name}`);
      if (i.hypothesis) nl(i.hypothesis);
      if (i.challenges) nl(`\n⚠ ${i.challenges}`);
      nl('');
    });
  }
  if (d.ref_keywords?.length) { nl('## 延伸阅读关键词'); nl(''); nl(d.ref_keywords.map(k => '`' + k + '`').join('  ')); nl(''); }

  // Key citations export
  if (d.key_citations?.length) {
    nl('## 关键原文引用'); nl('');
    d.key_citations.forEach(c => {
      const q = typeof c === 'string' ? c : (c.quote || '');
      const lbl = typeof c === 'string' ? '' : (c.label || '');
      if (lbl) nl(`**${lbl}**`);
      nl(`> ${q}`);
      nl('');
    });
  }

  // Reading paths
  if (d.read_this_if?.length) {
    nl('## 阅读建议'); nl('');
    d.read_this_if.forEach(p => {
      const locs = p.locations
        ? p.locations.map(l => pageLabel(l.page) + (l.lines ? ' · ' + linesLabel(l.lines) : '')).join('、')
        : (p.pages || []).map(pg => pageLabel(pg)).join('、');
      nl(`- **${p.goal}**：${locs}`);
    });
    nl('');
  }

  // User annotations
  if (currentAnnotations.length) {
    nl('---'); nl('## 我的笔记'); nl('');
    currentAnnotations.forEach(a => {
      nl(`> ${a.text.slice(0, 80)}${a.text.length > 80 ? '…' : ''}`);
      nl('');
      nl(a.note);
      nl(`\n*${pageLabel(a.page)} · ${a.created_at}*`);
      nl('');
    });
  }

  // Download
  const md = lines.join('\n');
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(d.title || currentFilename || 'notes').replace(/[/\\:*?"<>|]/g, '_')}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(t('toast_notes_exported'), 'success');
}

function syncEditableToStructure() {
  if (!structure) return;
  sidebarBody.querySelectorAll('[data-path]').forEach(el => {
    const path = el.dataset.path;
    const val  = el.innerText;
    if (path === 'guide_intro')    structure.guide_intro    = val;
    else if (path === 'core_question')  structure.core_question  = val;
    else if (path === 'key_insight')    structure.key_insight    = val;
    else if (path === 'one_line_thesis') structure.one_line_thesis = val;
    else if (path === 'skeptics_note')  structure.skeptics_note  = val;
    else if (path.startsWith('theme.')) {
      const [, id, field] = path.split('.');
      const theme = structure.themes?.find(t => t.id === id);
      if (theme) theme[field] = val;
    }
  });
}
