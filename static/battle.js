/* PaperKnowKnow - KnowKnow dialogue module.
 * Right-side chat panel that talks to /battle/* endpoints.
 * Module-private state at top (these are local lets - not on window).
 * setupBattleListeners() is called from init() in app.js.
 * Reads shared globals (set by app.js):
 *   structure, learnLang, currentIntent, currentQuestion, currentLibId
 */

let _bpOpen = false;
let _bpSessionId = '';
let _bpContext = null;
let _bpMode = 'chat';

function _bp(id) { return document.getElementById(id); }

function _bpPaperContext(analysis) {
  if (!analysis) return {};
  return {
    title: analysis.title || currentFilename || ui().misc.unknownPaper,
    core_question: analysis.core_question || '',
    key_insight: analysis.key_insight || '',
    themes: (analysis.themes || []).slice(0, 6).map(t => ({
      heading: t.heading || '',
      narrative: t.narrative || '',
      highlight: t.highlight || '',
      citations: (t.citations || []).slice(0, 3).map(c => normalizeCitationItem(c).quote).filter(Boolean),
    })),
  };
}

function _bpDialogLanguage() {
  return topbarLangSel?.value || 'Chinese';
}

function battleSetContext(analysis) {
  _bpContext = analysis || null;
  const btn = _bp('battleOpenBtn');
  if (btn) btn.style.display = _bpContext ? '' : 'none';
  const title = _bp('bpTopicName');
  if (title && _bpContext) title.textContent = (_bpContext.title || currentFilename || ui().know.topic).slice(0, 24);
}

function battleClearContext() {
  _bpContext = null;
  _bpSessionId = '';
  const btn = _bp('battleOpenBtn');
  if (btn) btn.style.display = 'none';
  const panel = _bp('battlePanel');
  if (panel) panel.classList.remove('open');
  _bpOpen = false;
}

function toggleBattlePanel() {
  if (!_bpContext) {
    toast(ui().know.noContext);
    return;
  }
  const panel = _bp('battlePanel');
  const handle = document.getElementById('bpHandle');
  if (!panel) return;
  _bpOpen = !_bpOpen;
  panel.classList.toggle('open', _bpOpen);
  // ✕ closes fully — also hide the side handle so user re-opens via topbar
  if (handle) handle.style.display = 'none';
  if (_bpOpen && !_bpSessionId) _bpShowIdle();
}

function collapseBattlePanel() {
  const panel = _bp('battlePanel');
  const handle = document.getElementById('bpHandle');
  if (!panel) return;
  panel.classList.remove('open');
  _bpOpen = false;
  if (handle) handle.style.display = 'flex';
}

function expandBattlePanel() {
  const panel = _bp('battlePanel');
  const handle = document.getElementById('bpHandle');
  if (!panel) return;
  panel.classList.add('open');
  _bpOpen = true;
  if (handle) handle.style.display = 'none';
}

function selectBattleMode(mode) {
  const k = ui().know;
  _bpMode = mode === 'battle' ? 'battle' : 'chat';
  _bp('bpModeChat')?.classList.toggle('active', _bpMode === 'chat');
  _bp('bpModeBattle')?.classList.toggle('active', _bpMode === 'battle');
  const tag = _bp('bpModeTag');
  if (tag) tag.textContent = _bpMode === 'battle' ? k.check : k.chat;
  const start = _bp('bpStartBtn');
  if (start) start.textContent = k.start;
  const input = _bp('bpInput');
  if (input) input.placeholder = _bpMode === 'battle' ? k.answerPh : k.questionPh;
}

function _bpShowIdle() {
  _bp('bpIdle').style.display = '';
  _bp('bpChat').style.display = 'none';
  _bp('bpSummary').style.display = 'none';
  _bp('bpDino').style.display = 'none';
  selectBattleMode(_bpMode);
}

function _bpShowChat() {
  _bp('bpIdle').style.display = 'none';
  _bp('bpChat').style.display = '';
  _bp('bpSummary').style.display = 'none';
}

function _bpAppend(role, text) {
  const box = _bp('bpMsgs');
  if (!box) return;
  const isUser = role === 'user';
  const isThinking = role.includes('thinking');
  const row = document.createElement('div');
  row.className = `bm-row${isUser ? ' bm-user' : ''}`;
  const av = document.createElement('div');
  av.className = `bm-av ${isUser ? 'bm-av-user' : isThinking ? 'bm-av-think' : 'bm-av-ai'}`;
  av.textContent = isUser ? '我' : '🦕';
  const bubble = document.createElement('div');
  bubble.className = `bm-bubble ${isUser ? 'bm-bubble-user' : isThinking ? 'bm-bubble-think think-dots' : 'bm-bubble-ai'}`;
  bubble.textContent = text || '';
  row.appendChild(av);
  row.appendChild(bubble);
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
  return row;
}

async function battleStart() {
  if (!_bpContext) { toast(ui().know.startFirst); return; }
  const s = loadSettings();
  if (!s.apiKey) { toast(t('toast_need_api_key')); return; }
  const btn = _bp('bpStartBtn');
  if (btn) btn.disabled = true;
  try {
    const r = await fetch('/battle/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: _bpContext.title || currentFilename || ui().misc.unknownPaper,
        provider: s.provider || 'claude',
        api_key: s.apiKey,
        model: s.model || '',
        mode: _bpMode,
        lang: _bpDialogLanguage(),
        paper_context: _bpPaperContext(_bpContext),
      }),
    });
    if (!r.ok) throw new Error((await r.json()).detail || ui().know.startingErr);
    const data = await r.json();
    _bpSessionId = data.session_id;
    _bp('bpMsgs').innerHTML = '';
    _bpShowChat();
    _bpAppend('assistant', data.question);
  } catch (e) {
    toast(ui().know.startingErr + e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function battleSend() {
  const input = _bp('bpInput');
  const msg = (input?.value || '').trim();
  if (!msg) return;
  if (!_bpSessionId) { await battleStart(); if (!_bpSessionId) return; }
  input.value = '';
  _bpUpdateChars();
  _bpAppend('user', msg);
  const thinking = _bpAppend('assistant thinking', ui().know.thinking);
  try {
    const r = await fetch('/battle/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: _bpSessionId, message: msg }),
    });
    if (!r.ok) throw new Error((await r.json()).detail || ui().know.replyErr);
    const data = await r.json();
    thinking.remove();
    _bpAppend('assistant', data.reply);
  } catch (e) {
    thinking.remove();
    toast(ui().know.replyErr + e.message);
  }
}

async function battleAskHelp() {
  const dino = _bp('bpDino');
  const dinoText = _bp('bpDinoText');
  if (!_bpSessionId) {
    if (dino && dinoText) {
      dino.style.display = '';
      dinoText.textContent = ui().know.startHelp;
    }
    return;
  }
  const stuck = (_bp('bpInput')?.value || '').trim() || ui().know.stuckDefault;
  if (dino && dinoText) {
    dino.style.display = '';
    dinoText.textContent = ui().know.helpThinking;
  }
  try {
    const r = await fetch('/battle/help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: _bpSessionId, stuck_on: stuck }),
    });
    if (!r.ok) throw new Error((await r.json()).detail || ui().know.helpFail);
    const data = await r.json();
    if (dinoText) dinoText.textContent = data.scaffold;
  } catch (e) {
    if (dinoText) dinoText.textContent = ui().know.helpErr + e.message;
  }
}

async function battleEnd() {
  if (!_bpSessionId) { _bpShowIdle(); return; }
  try {
    const r = await fetch('/battle/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: _bpSessionId }),
    });
    if (!r.ok) throw new Error((await r.json()).detail || ui().know.summaryFail);
    const data = await r.json();
    _bpSessionId = '';
    _bp('bpIdle').style.display = 'none';
    _bp('bpChat').style.display = 'none';
    _bp('bpSummary').style.display = '';
    _bp('bpSumSticking').textContent = data.sticking_point || ui().know.summaryDefault;
    _bp('bpSumBefore').textContent = data.card_before || '';
    _bp('bpSumAfter').textContent = data.card_after || '';
    _bp('bpSumTherefore').textContent = data.card_therefore || '';
    _bp('bpSumNext').textContent = data.next_attack ? `${ui().know.next}${data.next_attack}` : '';
  } catch (e) {
    toast(ui().know.summaryFail + '：' + e.message);
  }
}

function battleReset() {
  _bpSessionId = '';
  _bpShowIdle();
}

function _bpUpdateChars() {
  const input = _bp('bpInput');
  const chars = _bp('bpChars');
  if (input && chars) chars.textContent = `${input.value.length} / ${input.maxLength || 500}`;
}

function applyKnowKnowUi() {
  const k = ui().know;
  const title = $('bpTopicName');
  if (title && !_bpContext) title.textContent = k.topic;
  const idle = document.querySelector('.bp-idle-text');
  if (idle) idle.textContent = k.select;
  const chat = $('bpModeChat');
  if (chat) {
    chat.querySelector('.bp-mode-name').textContent = k.chat;
    chat.querySelector('.bp-mode-desc').textContent = k.chatDesc;
  }
  const check = $('bpModeBattle');
  if (check) {
    check.querySelector('.bp-mode-name').textContent = k.check;
    check.querySelector('.bp-mode-desc').textContent = k.checkDesc;
  }
  const end = $('bpEndBtn');
  if (end) end.title = k.done;
  const close = document.querySelector('#battlePanel .bp-actions button:last-child');
  if (close) close.title = k.close;
  const send = $('bpSend');
  if (send) send.textContent = k.send;
  const sumTitle = document.querySelector('.bp-sum-title');
  if (sumTitle) sumTitle.textContent = k.summary;
  const sumLabel = document.querySelector('.bp-sum-field label');
  if (sumLabel) sumLabel.textContent = k.clarify;
  const cont = document.querySelector('#bpSummary .bp-start-btn');
  if (cont) cont.textContent = k.cont;
  selectBattleMode(_bpMode);
}

function setupBattleListeners() {
  _bp('bpInput') && _bp('bpInput').addEventListener('input', _bpUpdateChars);
}
