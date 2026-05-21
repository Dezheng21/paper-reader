/* PaperKnowKnow — Unified i18n (single source of truth).
 *
 * Loaded BEFORE app.js. Exposes on window:
 *   t(key, vars?)  - flat key OR dotted-path lookup, with current → en → zh fallback.
 *                    Examples:  t('open_paper'), t('intents.quick.title'),
 *                               t('labels.coreQuestion'), t('mismatch', {out:'中文',ui:'English'})
 *   lab(key)        - shorthand for labels lookup (kept for backward-compat with existing call sites).
 *   ui()            - returns the current language pack object (current → en → zh).
 *   fillVars(s,v)   - replace {name} placeholders in a string.
 *   _uiLang         - current language code; setUiLang in app.js mutates this directly.
 *   LANG_CODE       - { 'Chinese': 'zh', ... }   display name → code
 *   LANG_DISPLAY    - { 'Chinese': '中文（简体）', ... }   display name → native name
 *   I18N            - the full data table (exposed for DevTools inspection only).
 *
 * Every I18N[lang] has 8 namespaces: ui, intents, know, lib, settings, doc, misc, labels.
 *
 * Adding a new translation key: edit ONE place — the corresponding namespace for each lang.
 * The startup self-check warns in console.warn if any lang is missing a key that zh has.
 */
(function (global) {
  'use strict';

  // ─── Language code maps ─────────────────────────────────────────────────
  var LANG_CODE = {
    'Chinese': 'zh', 'English': 'en', 'Chinese Traditional': 'zh-TW',
    'Japanese': 'ja', 'Korean': 'ko', 'French': 'fr',
    'German': 'de', 'Spanish': 'es', 'Vietnamese': 'vi'
  };
  var LANG_DISPLAY = {
    'Chinese': '中文（简体）', 'English': 'English', 'Chinese Traditional': '中文（繁體）',
    'Japanese': '日本語', 'Korean': '한국어', 'French': 'Français',
    'German': 'Deutsch', 'Spanish': 'Español', 'Vietnamese': 'Tiếng Việt'
  };

  // ─── Unified translation table ──────────────────────────────────────────
  var I18N = {};

  // ━━━ zh (中文简体) — full native ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  I18N.zh = {
    ui: {
      title: 'PaperKnowKnow', open_paper: '打开论文', analyze_btn: '论文分析',
      no_file: '未打开文件', sidebar_label: '分析结果', export_btn: '导出',
      analyzing: 'AI 正在分析论文…',
      empty_state: '打开论文后点击<br>「论文分析」查看解读',
      drop_zone: '拖入 PDF 或点击「打开论文」',
      copy: '复制', add_note: '添加笔记', add_note_ph: '添加笔记…',
      cancel: '取消', save_note: '保存笔记',
      search_ph: '在 PDF 中搜索…', search_no_result: '无结果',
      learn_lang: '语言学习', library: '📚 书架', settings: '⚙ 设置',
      toast_note_saved: '笔记已保存', toast_copied: '已复制到剪贴板',
      toast_lib_saved: '分析已保存到书架', toast_lib_loaded: '已从书架加载',
      toast_deleted: '已删除', toast_notes_exported: '笔记已导出为 Markdown',
      toast_md_done: 'MD 文件已下载', toast_need_api_key: '请先在设置中配置 API Key',
      toast_need_pdf: '请先打开 PDF', toast_found_page: '在第 {n} 页找到',
      toast_no_match: '未在当前 PDF 中匹配到此段文字（可手动 Ctrl+F 搜索）',
      toast_analyze_failed: '分析失败：', toast_ocr_done: 'OCR 完成，现在可以搜索了',
      toast_load_failed: '加载失败：', toast_md_failed: '转换失败：',
      toast_export_first: '请先分析论文后再导出', toast_need_api_key2: '请先在设置中填写 API Key',
      toast_no_scanned: '未检测到扫描页面',
      page_label: '第 {n} 页', new_tab: '新论文',
      settings_title: '设置', intent_title: '选择分析方式',
      intent_purpose: '你读这篇文章的目的',
      intent_question_ph: '我想了解……',
      intent_tip: '鼠标悬停在左侧选项上查看详细说明',
      intent_confirm: '开始论文分析',
      lib_title: '📚 书架', lib_search_ph: '搜索标题…',
      lib_empty: '还没有保存的论文', lib_loading: '加载中…', lib_failed: '加载失败',
      lib_no_match: '没有匹配的论文',
      validate_btn: '验证', validate_btn_ing: '验证中…', validate_fill: '请先填写 API Key',
      validate_failed: '验证失败', validate_server: '无法连接到服务器',
      save_btn: '保存', api_key_ph: '粘贴你的 API Key…',
      converting: '转换中…', search_count: '{a} / {b}',
      toast_search_failed: '搜索失败', settings_saved: '设置已保存',
      api_local_note: '仅存储在本地浏览器，不上传到服务器',
      output_lang_note: '无论论文用何种语言，AI 分析结果将翻译为此语言',
      label_provider: 'AI 服务商', label_apikey: 'API Key',
      label_output_lang: '输出语言', label_model: '模型',
      label_model_opt: '（留空使用默认）', model_ph: '如 claude-sonnet-4-6、gpt-4o…',
      tab_new_title: '新标签页', learnlang_tooltip: '开启后，AI 会在分析结果中额外提取 5-8 个核心术语，附上原文词汇、译文和释义。适合在阅读外文文献时同步学习专业词汇。会额外消耗少量 token。',
      expand_full: '展开完整分析', collapse_full: '收起完整分析',
      mismatch: '你选择的输出语言（{out}）和界面语言（{ui}）不同，确定要继续吗？',
      pdf_locate: 'PDF 定位', lines_label: '{r} 行'
    },
    intents: {
      quick:      { title: '快速看懂', badge: '速读', desc: '不一定读原文，先抓住问题、结论和意义', body: '把论文压缩成高信号解读：它问什么、回答什么、为什么重要。\n\n适合不一定读原文，先判断这篇论文值不值得深入。\n\n输出：核心问题 · 关键结论 · 3-5 个要点 · 最小阅读路径。' },
      deep:       { title: '精读导读', badge: '导读', desc: '准备读原文，先看清论证路线和重点页码', body: '为精读原文做预热：先看清作者如何进入问题、怎样推进论证、哪些页面值得慢读。\n\n适合准备认真读原文、做课堂讨论或组会汇报前使用。\n\n输出：论证路线 · 关键转折 · 慢读页码 · 阅读提示。' },
      question:   { title: '带问题读', badge: '问答', desc: '围绕你的问题，直接找答案、证据和边界', body: '从你的具体问题出发，不做泛泛导读：先回答问题，再给论文证据，同时指出论文没有回答或无法证明的部分。\n\n适合已经知道自己想查什么，想让论文服务于某个问题的场景。' },
      deep_notes: { title: '文献笔记', badge: '深度', desc: '完整提取论文逻辑骨架、方法与结果', body: '提取可保存、可复用的论文笔记：\n\n• 核心贡献\n• 问题意识与假设\n• 方法流程\n• 关键结果\n• 局限与未来研究。' },
      critical:   { title: '审稿视角', badge: '审稿', desc: '公平评估贡献、证据链、方法限制和硬伤', body: '模拟公正但严格的审稿人：先承认贡献，再评估创新是否成立、证据链是否支撑结论、方法是否有硬伤。\n\n适合评估可信度、筛选综述材料。' },
      research:   { title: '选题推进', badge: '科研', desc: '结合你的课题，挖掘空白、迁移方法和选题', body: '把这篇论文和你的研究课题接起来：找到可迁移的方法、未解决的空白、可操作的选题或实验方向。\n\n需要你输入自己的研究课题。' }
    },
    know: { topic: '论文对话', select: '选择对话模式', chat: '问答', chatDesc: '解释论文内容，澄清不懂的地方', check: '检查理解', checkDesc: '用几个问题确认你是否掌握核心论证', start: '开始', done: '完成', close: '关闭', answerPh: '输入你的回答…', questionPh: '输入你的问题…', send: '发送 ›', summary: '小结', clarify: '需要澄清的地方', cont: '继续', noContext: '请先完成一次论文分析，再打开 KnowKnow 对话。', startFirst: '请先完成论文分析', startingErr: 'KnowKnow 启动失败：', thinking: 'KnowKnow 正在整理上下文…', replyErr: 'KnowKnow 回复失败：', startHelp: '先开始一轮对话，再使用 KnowKnow!!!。', helpThinking: 'KnowKnow 正在整理提示…', stuckDefault: '我现在有点卡住，不知道怎么继续。', helpErr: '这一步没接上：', helpFail: '提示生成失败', summaryFail: '总结失败', summaryDefault: '这轮主要是在整理理解。', next: '建议下一步：' },
    lib: { organize: '整理', export: '导出', organizeTitle: '整理旧记录标签', exportTitle: '导出整个书架', organizeConfirm: '整理旧记录会补充分析方式、作者、年份标签，不会改动分析正文。现在开始吗？', organizing: '整理中', organizeFailed: '整理失败', organizeDone: '整理完成：扫描 {scanned} 条，更新 {changed} 条', savedAt: '保存于', addTag: '+ 标签', open: '打开', delete: '删除', tagPh: '输入标签回车确认', deleteConfirm: '确认删除此条记录？PDF 副本也会一并删除。', loadingPaper: '正在加载论文…', analysisLoadFailed: '分析数据加载失败' },
    settings: { maxChars: '最大分析长度：', chars: '字符', maxInfo: '支持约 {pages} 页以内的论文完整分析 · 每次实际消耗约 {low}–{high} token（含输出）', maxWarn: '  ⚠️ 超大文档，消耗较多 token，建议仅在必要时使用', maxHint: '增大后可分析更长文档，但每次调用消耗更多 token', valid: '✓ API Key 有效' },
    doc: { title: '文档体检', high: '文字层较完整', medium: '文字层不完整', low: '疑似扫描版', ocrYes: '本地 OCR 可用，会优先用于扫描页。', ocrNo: '本地 OCR 暂不可用；扫描页会退回到 AI 视觉/OCR。', pages: '页数', coverage: '文字层覆盖', scanned: '疑似扫描页', images: '图片/图表对象' },
    misc: { prev: '上一个', next: '下一个', ocr: '对扫描版页面进行 AI OCR 识别', close: '关闭', fontDec: '缩小字体', fontInc: '放大字体', exportMd: '导出笔记为 Markdown', searchLoading: '搜索中…', loadingPdf: '正在加载 PDF…', uploadFailed: '上传失败', searchOriginal: '搜索原文位置…', unknownPaper: '未知论文', newPaper: '新论文', clickAnalyze: '点击「论文分析」<br>让 AI 解读论文', openAnalyze: '打开论文后点击<br>「论文分析」查看解读', researchPh: '我的研究课题是……（例如：利用大模型进行医疗诊断）' },
    labels: {
      currentMethod: '当前分析方法', coreQuestion: '核心问题', coreConclusion: '核心结论',
      argumentRoute: '论证路线', evidenceChain: '证据链', conceptNodes: '概念节点', readingPath: '阅读路径',
      noEvidence: '暂无证据链。建议重新分析或补充引用。', noConcepts: '暂无概念节点', noReadingPath: '暂无阅读路径。',
      verified: '✓ 原文可验证', unverified: '⚠ 未在原文中找到', notChecked: '○ 未检查',
      evidenceCheck: '证据检查', found: '条可在原文中找到', notFound: '条未找到', unchecked: '条未检查',
      scannedWarn: '提示：PDF 文本提取很少，扫描版论文的验证可信度会下降。',
      keyInsight: '核心发现', worthNoting: '值得留意', keyQuotes: '关键原文引用', readingAdvice: '阅读建议', vocab: '核心词汇',
      contributions: '核心贡献', researchMethod: '研究方法', keyResults: '关键结果', limitsFuture: '局限与未来方向',
      authorAdmits: '作者承认', blindSpot: '潜在盲点', innovationEval: '创新性评估', methodIssues: '方法问题',
      hardWeaknesses: '主要硬伤', citationAdvice: '引用建议', transfer: '方法迁移分析', gaps: '研究空白',
      experimentIdeas: '实验方向', furtherKeywords: '推荐延伸阅读', unknownTitle: '未知标题',
      problem: '问题', method: '方法', finding: '发现', conclusion: '结论',
      modeLiterature: '文献笔记重点', modeReview: '审稿视角重点', modeResearch: '选题推进重点',
      modeQuestion: '带问题读重点', modeDeep: '精读导读重点'
    }
  };

  // ━━━ en (English) — full native ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  I18N.en = {
    ui: {
      title: 'PaperKnowKnow', open_paper: 'Open Paper', analyze_btn: 'Analyze',
      no_file: 'No file open', sidebar_label: 'Guide', export_btn: '↓ Export',
      analyzing: 'AI is analyzing…',
      empty_state: 'Open a paper then click<br>"Analyze" to view outline',
      drop_zone: 'Drop a PDF or click "Open Paper"',
      copy: 'Copy', add_note: 'Add Note', add_note_ph: 'Add note…',
      cancel: 'Cancel', save_note: 'Save Note',
      search_ph: 'Search in PDF…', search_no_result: 'No results',
      learn_lang: 'Lang Learning', library: '📚 Library', settings: '⚙ Settings',
      toast_note_saved: 'Note saved', toast_copied: 'Copied to clipboard',
      toast_lib_saved: 'Analysis saved to library', toast_lib_loaded: 'Loaded from library',
      toast_deleted: 'Deleted', toast_notes_exported: 'Notes exported as Markdown',
      toast_md_done: 'MD file downloaded', toast_need_api_key: 'Please configure API Key in Settings first',
      toast_need_pdf: 'Please open a PDF first', toast_found_page: 'Found on page {n}',
      toast_no_match: 'Text not found in current PDF (try Ctrl+F manually)',
      toast_analyze_failed: 'Analysis failed: ', toast_ocr_done: 'OCR complete, you can now search',
      toast_load_failed: 'Load failed: ', toast_md_failed: 'Conversion failed: ',
      toast_export_first: 'Please analyze the paper first', toast_need_api_key2: 'Please fill in API Key in Settings',
      toast_no_scanned: 'No scanned pages detected',
      page_label: 'Page {n}', new_tab: 'New Paper',
      settings_title: 'Settings', intent_title: 'Start Analysis',
      intent_purpose: 'Your reading purpose',
      intent_question_ph: 'I want to know about…',
      intent_tip: 'Hover over options on the left for details',
      intent_confirm: 'Start Analysis',
      lib_title: '📚 Library', lib_search_ph: 'Search titles…',
      lib_empty: 'No saved papers', lib_loading: 'Loading…', lib_failed: 'Load failed',
      lib_no_match: 'No matching papers',
      validate_btn: 'Validate', validate_btn_ing: 'Validating…', validate_fill: 'Please enter API Key first',
      validate_failed: 'Validation failed', validate_server: 'Cannot connect to server',
      save_btn: 'Save', api_key_ph: 'Paste your API Key…',
      converting: 'Converting…', search_count: '{a} / {b}',
      toast_search_failed: 'Search failed', settings_saved: 'Settings saved',
      api_local_note: 'Stored locally in browser only, never uploaded',
      output_lang_note: 'AI analysis will be translated into this language regardless of the paper language',
      label_provider: 'AI Provider', label_apikey: 'API Key',
      label_output_lang: 'Output Language', label_model: 'Model',
      label_model_opt: '(leave blank for default)', model_ph: 'e.g. claude-sonnet-4-6, gpt-4o…',
      tab_new_title: 'New tab', learnlang_tooltip: 'When enabled, AI will extract 5–8 key terms with original vocabulary, translation, and definitions. Useful for reading foreign-language papers. Uses a small amount of extra tokens.',
      expand_full: 'Show full analysis', collapse_full: 'Hide full analysis',
      mismatch: 'Output language ({out}) differs from UI language ({ui}). Continue?',
      pdf_locate: 'Find in PDF', lines_label: 'lines {r}'
    },
    intents: {
      quick:      { title: 'Quick Read', badge: 'skim', desc: 'Get the question, conclusion, and significance first', body: 'Compress the paper into a high-signal reading: what it asks, what it answers, and why it matters.\n\nBest when you may not read the full paper yet.\n\nOutput: core question · key conclusion · 3-5 takeaways · minimal reading path.' },
      deep:       { title: 'Close Reading Guide', badge: 'guide', desc: 'Prepare for close reading with route and key pages', body: 'Prepare attention before close reading: how the author enters the problem, builds the argument, and where the slow-reading pages are.\n\nOutput: argument route · turning points · key pages · reading notes.' },
      question:   { title: 'Question-led Reading', badge: 'Q&A', desc: 'Use your question to find answers, evidence, and limits', body: 'Start from your own question: answer it, show the paper evidence, and clarify what the paper does not prove.\n\nBest when you know what you want from the paper.' },
      deep_notes: { title: 'Literature Notes', badge: 'deep', desc: 'Extract argument structure, method, and results', body: 'Create reusable research notes:\n\n• Contributions\n• Problem and assumptions\n• Method flow\n• Key results\n• Limits and future work.' },
      critical:   { title: 'Review Lens', badge: 'review', desc: 'Assess contribution, evidence, methods, and weaknesses', body: 'Act like a fair but demanding reviewer: recognize the contribution, then test whether evidence and method support it.\n\nGood for credibility checks and literature screening.' },
      research:   { title: 'Research Direction', badge: 'research', desc: 'Find gaps, transferable methods, and topic angles', body: 'Connect this paper to your own research topic: transferable methods, unsolved gaps, and actionable directions.\n\nRequires your research topic.' }
    },
    know: { topic: 'Paper Dialogue', select: 'Choose a mode', chat: 'Q&A', chatDesc: 'Explain the paper and clarify confusing parts', check: 'Check Understanding', checkDesc: 'Use a few questions to verify the core argument', start: 'Start', done: 'Done', close: 'Close', answerPh: 'Type your answer…', questionPh: 'Type your question…', send: 'Send ›', summary: 'Summary', clarify: 'Needs clarification', cont: 'Continue', noContext: 'Analyze a paper first, then open KnowKnow.', startFirst: 'Please analyze a paper first', startingErr: 'KnowKnow failed to start: ', thinking: 'KnowKnow is organizing the context…', replyErr: 'KnowKnow reply failed: ', startHelp: 'Start a dialogue first, then use KnowKnow!!!.', helpThinking: 'KnowKnow is preparing a hint…', stuckDefault: 'I am stuck and not sure how to continue.', helpErr: 'Could not continue here: ', helpFail: 'Hint generation failed', summaryFail: 'Summary failed', summaryDefault: 'This round mainly organized understanding.', next: 'Suggested next step: ' },
    lib: { organize: 'Organize', export: 'Export', organizeTitle: 'Organize old record tags', exportTitle: 'Export the whole library', organizeConfirm: 'Organize old records by adding method, author, and year tags. Analysis text will not be changed. Start now?', organizing: 'Organizing', organizeFailed: 'Organize failed', organizeDone: 'Organized: scanned {scanned}, updated {changed}', savedAt: 'saved at', addTag: '+ tag', open: 'Open', delete: 'Delete', tagPh: 'Type a tag and press Enter', deleteConfirm: 'Delete this record? The PDF copy will also be deleted.', loadingPaper: 'Loading paper…', analysisLoadFailed: 'Failed to load analysis data' },
    settings: { maxChars: 'Max analysis length: ', chars: 'chars', maxInfo: 'Supports about {pages} pages · estimated cost {low}–{high} tokens per run including output', maxWarn: '  ⚠️ Very large document; use only when necessary', maxHint: 'Increasing this allows longer documents but costs more tokens per call', valid: '✓ API Key is valid' },
    doc: { title: 'Document Check', high: 'Text layer mostly complete', medium: 'Text layer incomplete', low: 'Likely scanned', ocrYes: 'Local OCR is available and will be used for scanned pages first.', ocrNo: 'Local OCR is unavailable; scanned pages fall back to AI vision/OCR.', pages: 'Pages', coverage: 'Text coverage', scanned: 'Scanned pages', images: 'Images/charts' },
    misc: { prev: 'Previous', next: 'Next', ocr: 'Run AI OCR on scanned pages', close: 'Close', fontDec: 'Decrease font size', fontInc: 'Increase font size', exportMd: 'Export notes as Markdown', searchLoading: 'Searching…', loadingPdf: 'Loading PDF…', uploadFailed: 'Upload failed', searchOriginal: 'Searching original location…', unknownPaper: 'Unknown paper', newPaper: 'New paper', clickAnalyze: 'Click "Analyze"<br>to let AI read the paper', openAnalyze: 'Open a paper then click<br>"Analyze" to view analysis', researchPh: 'My research topic is…' },
    labels: {
      currentMethod: 'Analysis Method', coreQuestion: 'Core Question', coreConclusion: 'Core Conclusion',
      argumentRoute: 'Argument Route', evidenceChain: 'Evidence Chain', conceptNodes: 'Concept Nodes', readingPath: 'Reading Path',
      noEvidence: 'No evidence chain yet. Re-analyze or add citations.', noConcepts: 'No concept nodes yet', noReadingPath: 'No reading path yet.',
      verified: '✓ Verified in source', unverified: '⚠ Not found in source', notChecked: '○ Not checked',
      evidenceCheck: 'Evidence check', found: 'found in source', notFound: 'not found', unchecked: 'not checked',
      scannedWarn: 'Note: PDF text extraction is sparse, so verification is less reliable for scanned papers.',
      keyInsight: 'Key Insight', worthNoting: 'Worth Noting', keyQuotes: 'Key Source Quotes', readingAdvice: 'Reading Advice', vocab: 'Key Terms',
      contributions: 'Core Contributions', researchMethod: 'Research Method', keyResults: 'Key Results', limitsFuture: 'Limits and Future Work',
      authorAdmits: 'Author admits', blindSpot: 'Potential blind spot', innovationEval: 'Innovation Assessment', methodIssues: 'Method Issues',
      hardWeaknesses: 'Main Weaknesses', citationAdvice: 'Citation Note', transfer: 'Method Transfer', gaps: 'Research Gaps',
      experimentIdeas: 'Research Ideas', furtherKeywords: 'Further Reading Keywords', unknownTitle: 'Unknown title',
      problem: 'Problem', method: 'Method', finding: 'Finding', conclusion: 'Conclusion',
      modeLiterature: 'Literature Notes Focus', modeReview: 'Review Lens Focus', modeResearch: 'Research Direction Focus',
      modeQuestion: 'Question-led Focus', modeDeep: 'Close Reading Focus'
    }
  };

  // ━━━ zh-TW (中文繁體) — Traditional Chinese ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Traditional readers can read Simplified labels fine — labels inherit from zh.
  // misc inherits from zh (same UI vocabulary applies).
  I18N['zh-TW'] = {
    ui: {
      title: 'PaperKnowKnow', open_paper: '開啟論文', analyze_btn: '論文分析',
      no_file: '未開啟文件', sidebar_label: '分析結果', export_btn: '匯出',
      analyzing: 'AI 正在分析論文…',
      empty_state: '開啟論文後點擊<br>「論文分析」查看分析結果',
      drop_zone: '拖入 PDF 或點擊「開啟論文」',
      copy: '複製', add_note: '新增筆記', add_note_ph: '新增筆記…',
      cancel: '取消', save_note: '儲存筆記',
      search_ph: '在 PDF 中搜尋…', search_no_result: '無結果',
      learn_lang: '語言學習', library: '📚 書架', settings: '⚙ 設定',
      toast_note_saved: '筆記已儲存', toast_copied: '已複製到剪貼簿',
      toast_lib_saved: '分析已儲存到書架', toast_lib_loaded: '已從書架載入',
      toast_deleted: '已刪除', toast_notes_exported: '筆記已匯出為 Markdown',
      toast_md_done: 'MD 檔案已下載', toast_need_api_key: '請先在設定中配置 API Key',
      toast_need_pdf: '請先開啟 PDF', toast_found_page: '在第 {n} 頁找到',
      toast_no_match: '未在目前 PDF 中找到此段文字（可手動 Ctrl+F 搜尋）',
      toast_analyze_failed: '分析失敗：', toast_ocr_done: 'OCR 完成，現在可以搜尋了',
      toast_load_failed: '載入失敗：', toast_md_failed: '轉換失敗：',
      toast_export_first: '請先分析論文後再匯出', toast_need_api_key2: '請先在設定中填寫 API Key',
      toast_no_scanned: '未偵測到掃描頁面',
      page_label: '第 {n} 頁', new_tab: '新論文',
      settings_title: '設定', intent_title: '開始分析',
      intent_purpose: '你閱讀這篇文章的目的',
      intent_question_ph: '我想了解……',
      intent_tip: '將滑鼠懸停在左側選項上查看詳細說明',
      intent_confirm: '開始分析',
      lib_title: '📚 書架', lib_search_ph: '搜尋標題…',
      lib_empty: '還沒有儲存的論文', lib_loading: '載入中…', lib_failed: '載入失敗',
      lib_no_match: '沒有符合的論文',
      validate_btn: '驗證', validate_btn_ing: '驗證中…', validate_fill: '請先填寫 API Key',
      validate_failed: '驗證失敗', validate_server: '無法連線至伺服器',
      save_btn: '儲存', api_key_ph: '貼上您的 API Key…',
      converting: '轉換中…', search_count: '{a} / {b}',
      toast_search_failed: '搜尋失敗', settings_saved: '設定已儲存',
      api_local_note: '僅儲存在本地瀏覽器，不上傳至伺服器',
      output_lang_note: '無論論文使用何種語言，AI 分析結果將翻譯為此語言',
      label_provider: 'AI 服務商', label_apikey: 'API Key',
      label_output_lang: '輸出語言', label_model: '模型',
      label_model_opt: '（留空使用預設）', model_ph: '如 claude-sonnet-4-6、gpt-4o…',
      tab_new_title: '新標籤頁', learnlang_tooltip: '開啟後，AI 會在分析結果中額外提取 5-8 個核心術語，附上原文詞彙、譯文和釋義。適合閱讀外文文獻時同步學習專業詞彙。會額外消耗少量 token。',
      expand_full: '展開完整分析', collapse_full: '收起完整分析',
      mismatch: '你選擇的輸出語言（{out}）和介面語言（{ui}）不同，確定要繼續嗎？',
      pdf_locate: 'PDF 定位', lines_label: '{r} 行'
    },
    intents: {
      quick:      { title: '快速看懂', badge: '速讀', desc: '不一定讀原文，先抓住問題、結論和意義', body: I18N.zh.intents.quick.body },
      deep:       { title: '精讀導讀', badge: '導讀', desc: '準備讀原文，先看清論證路線和重點頁碼', body: I18N.zh.intents.deep.body },
      question:   { title: '帶問題讀', badge: '問答', desc: '圍繞你的問題，直接找答案、證據和邊界', body: I18N.zh.intents.question.body },
      deep_notes: { title: '文獻筆記', badge: '深度', desc: '完整提取論文邏輯骨架、方法與結果', body: I18N.zh.intents.deep_notes.body },
      critical:   { title: '審稿視角', badge: '審稿', desc: '公平評估貢獻、證據鏈、方法限制和硬傷', body: I18N.zh.intents.critical.body },
      research:   { title: '選題推進', badge: '科研', desc: '結合你的課題，挖掘空白、遷移方法和選題', body: I18N.zh.intents.research.body }
    },
    know:     Object.assign({}, I18N.zh.know,     { topic: '論文對話', select: '選擇對話模式', check: '檢查理解', clarify: '需要澄清的地方', cont: '繼續' }),
    lib:      Object.assign({}, I18N.zh.lib,      { organize: '整理', export: '匯出', open: '開啟', delete: '刪除', addTag: '+ 標籤', savedAt: '儲存於' }),
    settings: Object.assign({}, I18N.zh.settings, { maxChars: '最大分析長度：', chars: '字元', valid: '✓ API Key 有效' }),
    doc:      Object.assign({}, I18N.zh.doc,      { title: '文件體檢' }),
    misc:     I18N.zh.misc,    // identical UI vocabulary
    labels:   I18N.zh.labels   // Traditional readers parse Simplified labels fine
  };

  // ━━━ ja (日本語) — native ui / intents / labels ; en-based partial overrides for the rest ━━━
  I18N.ja = {
    ui: {
      title: 'PaperKnowKnow', open_paper: '論文を開く', analyze_btn: '論文分析',
      no_file: 'ファイル未選択', sidebar_label: '分析結果', export_btn: 'エクスポート',
      analyzing: 'AI が分析中…',
      empty_state: 'PDFを開いて<br>「論文分析」をクリック',
      drop_zone: 'PDFをドロップまたは「論文を開く」',
      copy: 'コピー', add_note: 'メモを追加', add_note_ph: 'メモを追加…',
      cancel: 'キャンセル', save_note: 'メモを保存',
      search_ph: 'PDFを検索…', search_no_result: '結果なし',
      learn_lang: '言語学習', library: '📚 ライブラリ', settings: '⚙ 設定',
      toast_note_saved: 'メモを保存しました', toast_copied: 'クリップボードにコピーしました',
      toast_lib_saved: '分析をライブラリに保存しました', toast_lib_loaded: 'ライブラリから読み込みました',
      toast_deleted: '削除しました', toast_notes_exported: 'メモをMarkdownでエクスポートしました',
      toast_md_done: 'MDファイルをダウンロードしました', toast_need_api_key: '設定でAPIキーを設定してください',
      toast_need_pdf: 'まずPDFを開いてください', toast_found_page: '{n}ページで見つかりました',
      toast_no_match: '現在のPDFでテキストが見つかりません（Ctrl+Fで手動検索）',
      toast_analyze_failed: '分析失敗：', toast_ocr_done: 'OCR完了、検索できます',
      toast_load_failed: '読み込み失敗：', toast_md_failed: '変換失敗：',
      toast_export_first: '先に論文を分析してください', toast_need_api_key2: '設定にAPIキーを入力してください',
      toast_no_scanned: 'スキャンページが見つかりません',
      page_label: '{n}ページ', new_tab: '新しい論文',
      settings_title: '設定', intent_title: '分析開始',
      intent_purpose: 'この論文を読む目的',
      intent_question_ph: '知りたいことは…',
      intent_tip: '左側のオプションにカーソルを合わせて詳細を確認',
      intent_confirm: '分析開始',
      lib_title: '📚 ライブラリ', lib_search_ph: 'タイトルを検索…',
      lib_empty: '保存された論文はありません', lib_loading: '読み込み中…', lib_failed: '読み込み失敗',
      lib_no_match: '一致する論文がありません',
      validate_btn: '検証', validate_btn_ing: '検証中…', validate_fill: 'APIキーを入力してください',
      validate_failed: '検証失敗', validate_server: 'サーバーに接続できません',
      save_btn: '保存', api_key_ph: 'APIキーを貼り付け…',
      converting: '変換中…', search_count: '{a} / {b}',
      toast_search_failed: '検索失敗', settings_saved: '設定を保存しました',
      api_local_note: 'ブラウザにローカル保存されます。サーバーに送信されません',
      output_lang_note: '論文の言語に関わらず、AI分析はこの言語で出力されます',
      label_provider: 'AIプロバイダー', label_apikey: 'APIキー',
      label_output_lang: '出力言語', label_model: 'モデル',
      label_model_opt: '（空白でデフォルト）', model_ph: '例: claude-sonnet-4-6、gpt-4o…',
      tab_new_title: '新しいタブ', learnlang_tooltip: '有効にすると、AIが解説に5〜8つのキー用語を追加します（原文・訳・解説付き）。外国語論文を読む際の語彙学習に役立ちます。少量の追加トークンが必要です。',
      expand_full: '完全な分析を表示', collapse_full: '完全な分析を非表示',
      mismatch: '出力言語（{out}）が画面の言語（{ui}）と異なります。続行しますか？',
      pdf_locate: 'PDFで探す', lines_label: '{r} 行'
    },
    intents: {
      quick:      { title: 'クイックリード', badge: '速読', desc: '原文を読む前に問題・結論・意義を把握', body: '論文を高密度に圧縮：何を問い、何を答え、なぜ重要か。\n\n論文を最後まで読まないかもしれない時に最適。\n\n出力：中心問題 · 主要結論 · 3-5個の要点 · 最小の読み順。' },
      deep:       { title: '精読ガイド', badge: 'ガイド', desc: '精読の前に論証ルートと重要ページを把握', body: '精読の前段階：著者がどのように問題に入り、論証を進め、どのページをじっくり読むべきかを把握します。\n\n出力：論証ルート · 重要な転換点 · 重点ページ · 読み方ヒント。' },
      question:   { title: '質問駆動読み', badge: 'Q&A', desc: '自分の質問から答え・根拠・限界を探る', body: '自分の具体的な質問から始めます：論文が支持する答えを示し、根拠を提示し、論文が答えていない範囲も明確にします。\n\n論文に何を求めるか分かっている時に最適。' },
      deep_notes: { title: '文献ノート', badge: '詳細', desc: '論文の論理骨格・方法・結果を抽出', body: '保存・再利用可能な研究ノートを作成：\n\n• 中核貢献\n• 問題意識と仮説\n• 方法の流れ\n• 主要結果\n• 限界と今後の研究。' },
      critical:   { title: '査読視点', badge: '査読', desc: '貢献・根拠・方法・弱点を公正に評価', body: '公正だが厳格な査読者として：貢献を認めた後、根拠と方法が結論を支えるかを検証します。\n\n信頼性チェックや文献スクリーニングに有用。' },
      research:   { title: '研究方向', badge: '研究', desc: '空白・転用可能な方法・研究角度を発見', body: 'この論文をあなたの研究テーマと結びつけます：転用可能な方法、未解決の空白、実行可能な研究方向。\n\nあなたの研究テーマの入力が必要です。' }
    },
    know:     Object.assign({}, I18N.en.know,     { topic: '論文対話', select: '対話モードを選択', chat: 'Q&A', check: '理解チェック', start: '開始', done: '完了', close: '閉じる', send: '送信 ›', summary: '要約', clarify: '確認が必要な点', cont: '続ける' }),
    lib:      Object.assign({}, I18N.en.lib,      { organize: '整理', export: 'エクスポート', open: '開く', delete: '削除', addTag: '+ タグ', savedAt: '保存日時' }),
    settings: Object.assign({}, I18N.en.settings, { maxChars: '最大分析長: ', chars: '文字', valid: '✓ API Key は有効です' }),
    doc:      Object.assign({}, I18N.en.doc,      { title: 'ドキュメント確認' }),
    misc:     I18N.en.misc,
    labels: {
      currentMethod: '分析方式', coreQuestion: '中心問題', coreConclusion: '中心結論',
      argumentRoute: '論証ルート', evidenceChain: '根拠の鎖', conceptNodes: '概念ノード', readingPath: '読み順',
      noEvidence: '根拠の鎖がまだありません。再分析または引用追加を検討してください。', noConcepts: '概念ノードがありません', noReadingPath: '読み順がまだありません。',
      verified: '✓ 原文で確認済み', unverified: '⚠ 原文で見つかりません', notChecked: '○ 未確認',
      evidenceCheck: '根拠チェック', found: '件 原文で確認', notFound: '件 見つかりません', unchecked: '件 未確認',
      scannedWarn: '注：PDFのテキスト抽出が少なく、スキャン版論文の検証精度は低下します。',
      keyInsight: '中心発見', worthNoting: '注目点', keyQuotes: '重要原文引用', readingAdvice: '読み方アドバイス', vocab: 'キー用語',
      contributions: '中核貢献', researchMethod: '研究方法', keyResults: '主要結果', limitsFuture: '限界と今後の方向',
      authorAdmits: '著者が認める', blindSpot: '潜在的盲点', innovationEval: '革新性評価', methodIssues: '方法の問題',
      hardWeaknesses: '主要な弱点', citationAdvice: '引用アドバイス', transfer: '方法の転用分析', gaps: '研究空白',
      experimentIdeas: '研究アイデア', furtherKeywords: '推薦延伸読みキーワード', unknownTitle: 'タイトル不明',
      problem: '問題', method: '方法', finding: '発見', conclusion: '結論',
      modeLiterature: '文献ノート重点', modeReview: '査読視点重点', modeResearch: '研究方向重点',
      modeQuestion: '質問駆動読み重点', modeDeep: '精読ガイド重点'
    }
  };

  // ━━━ ko (한국어) — full native ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  I18N.ko = {
    ui: {
      title: 'PaperKnowKnow', open_paper: '논문 열기', analyze_btn: '논문 분석',
      no_file: '파일 없음', sidebar_label: '분석 결과', export_btn: '내보내기',
      analyzing: 'AI가 분석 중…',
      empty_state: 'PDF를 열고<br>「논문 분석」을 클릭하세요',
      drop_zone: 'PDF를 드롭하거나 「논문 열기」클릭',
      copy: '복사', add_note: '메모 추가', add_note_ph: '메모 추가…',
      cancel: '취소', save_note: '메모 저장',
      search_ph: 'PDF에서 검색…', search_no_result: '결과 없음',
      learn_lang: '언어 학습', library: '📚 라이브러리', settings: '⚙ 설정',
      toast_note_saved: '메모가 저장되었습니다', toast_copied: '클립보드에 복사되었습니다',
      toast_lib_saved: '분석이 라이브러리에 저장되었습니다', toast_lib_loaded: '라이브러리에서 불러왔습니다',
      toast_deleted: '삭제되었습니다', toast_notes_exported: '메모가 Markdown으로 내보내졌습니다',
      toast_md_done: 'MD 파일이 다운로드되었습니다', toast_need_api_key: '먼저 설정에서 API Key를 설정하세요',
      toast_need_pdf: '먼저 PDF를 열어주세요', toast_found_page: '{n}페이지에서 발견',
      toast_no_match: '현재 PDF에서 해당 텍스트를 찾을 수 없습니다 (Ctrl+F로 수동 검색)',
      toast_analyze_failed: '분석 실패：', toast_ocr_done: 'OCR 완료, 이제 검색 가능합니다',
      toast_load_failed: '불러오기 실패：', toast_md_failed: '변환 실패：',
      toast_export_first: '먼저 논문을 분석해 주세요', toast_need_api_key2: '설정에서 API Key를 입력해 주세요',
      toast_no_scanned: '스캔 페이지가 감지되지 않았습니다',
      page_label: '{n}페이지', new_tab: '새 논문',
      settings_title: '설정', intent_title: '분석 시작',
      intent_purpose: '이 논문을 읽는 목적',
      intent_question_ph: '알고 싶은 것은…',
      intent_tip: '왼쪽 옵션에 마우스를 올려 상세 설명 확인',
      intent_confirm: '분석 시작',
      lib_title: '📚 라이브러리', lib_search_ph: '제목 검색…',
      lib_empty: '저장된 논문이 없습니다', lib_loading: '불러오는 중…', lib_failed: '불러오기 실패',
      lib_no_match: '일치하는 논문이 없습니다',
      validate_btn: '검증', validate_btn_ing: '검증 중…', validate_fill: '먼저 API Key를 입력하세요',
      validate_failed: '검증 실패', validate_server: '서버에 연결할 수 없습니다',
      save_btn: '저장', api_key_ph: 'API Key를 붙여넣기…',
      converting: '변환 중…', search_count: '{a} / {b}',
      toast_search_failed: '검색 실패', settings_saved: '설정이 저장되었습니다',
      api_local_note: '브라우저에 로컬 저장됩니다. 서버에 전송되지 않습니다',
      output_lang_note: '논문 언어에 관계없이 AI 분석 결과가 이 언어로 출력됩니다',
      label_provider: 'AI 서비스', label_apikey: 'API Key',
      label_output_lang: '출력 언어', label_model: '모델',
      label_model_opt: '（비워두면 기본값）', model_ph: '예: claude-sonnet-4-6, gpt-4o…',
      tab_new_title: '새 탭', learnlang_tooltip: '활성화하면 AI가 5~8개의 핵심 용어를 원문, 번역, 설명과 함께 추출합니다. 외국어 논문 읽기에 유용합니다. 소량의 추가 토큰이 필요합니다.',
      expand_full: '전체 분석 펼치기', collapse_full: '전체 분석 접기',
      mismatch: '선택한 출력 언어({out})와 화면 언어({ui})가 다릅니다. 계속할까요?',
      pdf_locate: 'PDF에서 찾기', lines_label: '{r}행'
    },
    intents: {
      quick:      { title: '빠르게 이해', badge: '속독', desc: '원문을 다 읽기 전, 문제·결론·의미를 먼저 파악', body: '논문의 핵심을 압축합니다: 무엇을 묻고, 무엇을 답하며, 왜 중요한지.\n\n원문을 전부 읽기 전에 가치와 방향을 판단할 때 적합합니다.\n\n출력: 핵심 질문 · 핵심 결론 · 3-5개 요점 · 최소 읽기 경로.' },
      deep:       { title: '정독 가이드', badge: '가이드', desc: '정독 전에 논증 흐름과 중요한 페이지를 파악', body: '정독을 위한 사전 안내입니다. 저자가 문제에 어떻게 들어가고, 논증을 어떻게 전개하며, 어떤 페이지를 천천히 읽어야 하는지 보여줍니다.' },
      question:   { title: '질문 중심 읽기', badge: '문답', desc: '내 질문을 기준으로 답, 근거, 한계를 찾기', body: '사용자의 구체적 질문에서 시작합니다. 먼저 논문이 지지하는 답을 제시하고, 근거와 논문이 답하지 못하는 범위를 함께 보여줍니다.' },
      deep_notes: { title: '문헌 노트', badge: '심화', desc: '논문의 논리 구조, 방법, 결과를 정리', body: '저장하고 다시 쓸 수 있는 문헌 노트를 만듭니다:\n\n• 핵심 기여\n• 문제의식과 가설\n• 방법 흐름\n• 주요 결과\n• 한계와 후속 연구.' },
      critical:   { title: '심사 관점', badge: '심사', desc: '기여, 근거, 방법, 약점을 균형 있게 평가', body: '공정하지만 엄격한 심사자처럼 봅니다. 기여를 먼저 인정한 뒤, 근거와 방법이 결론을 충분히 뒷받침하는지 점검합니다.' },
      research:   { title: '연구 주제 확장', badge: '연구', desc: '공백, 방법 이전, 새 연구 각도 찾기', body: '이 논문을 사용자의 연구 주제와 연결합니다. 이전 가능한 방법, 남은 공백, 실행 가능한 연구 방향을 찾습니다.\n\n사용자의 연구 주제가 필요합니다.' }
    },
    know: { topic: '논문 대화', select: '대화 모드 선택', chat: '문답', chatDesc: '논문 내용을 설명하고 헷갈리는 부분을 정리', check: '이해 점검', checkDesc: '몇 가지 질문으로 핵심 논증 이해를 확인', start: '시작', done: '완료', close: '닫기', answerPh: '답변을 입력하세요…', questionPh: '질문을 입력하세요…', send: '보내기 ›', summary: '요약', clarify: '더 명확히 볼 부분', cont: '계속', noContext: '먼저 논문 분석을 완료한 뒤 KnowKnow를 여세요.', startFirst: '먼저 논문 분석을 완료하세요', startingErr: 'KnowKnow 시작 실패: ', thinking: 'KnowKnow가 맥락을 정리하는 중…', replyErr: 'KnowKnow 응답 실패: ', startHelp: '먼저 대화를 시작한 뒤 KnowKnow!!!를 사용하세요.', helpThinking: 'KnowKnow가 힌트를 준비하는 중…', stuckDefault: '지금 막혀서 어떻게 이어가야 할지 모르겠습니다.', helpErr: '이 단계에서 이어가지 못했습니다: ', helpFail: '힌트 생성 실패', summaryFail: '요약 실패', summaryDefault: '이번 라운드는 이해를 정리하는 데 초점을 두었습니다.', next: '다음 제안: ' },
    lib: { organize: '정리', export: '내보내기', organizeTitle: '기존 기록 태그 정리', exportTitle: '전체 라이브러리 내보내기', organizeConfirm: '기존 기록에 분석 방식, 저자, 연도 태그를 보완합니다. 분석 본문은 바꾸지 않습니다. 시작할까요?', organizing: '정리 중', organizeFailed: '정리 실패', organizeDone: '정리 완료: {scanned}개 확인, {changed}개 업데이트', savedAt: '저장됨', addTag: '+ 태그', open: '열기', delete: '삭제', tagPh: '태그 입력 후 Enter', deleteConfirm: '이 기록을 삭제할까요? PDF 복사본도 함께 삭제됩니다.', loadingPaper: '논문을 불러오는 중…', analysisLoadFailed: '분석 데이터를 불러오지 못했습니다' },
    settings: { maxChars: '최대 분석 길이: ', chars: '자', maxInfo: '약 {pages}쪽까지 전체 분석 가능 · 예상 사용량 {low}–{high} tokens(출력 포함)', maxWarn: '  ⚠️ 매우 큰 문서입니다. 꼭 필요할 때만 사용하세요', maxHint: '값을 높이면 더 긴 문서를 분석할 수 있지만 호출마다 더 많은 token을 사용합니다', valid: '✓ API Key가 유효합니다' },
    doc: { title: '문서 상태 확인', high: '텍스트 레이어 양호', medium: '텍스트 레이어 불완전', low: '스캔본 가능성 높음', ocrYes: '로컬 OCR 사용 가능. 스캔 페이지에 우선 적용됩니다.', ocrNo: '로컬 OCR 사용 불가. 스캔 페이지는 AI 비전/OCR로 처리됩니다.', pages: '쪽수', coverage: '텍스트 레이어', scanned: '스캔 의심 페이지', images: '이미지/도표 객체' },
    misc: { prev: '이전', next: '다음', ocr: '스캔 페이지에 AI OCR 실행', close: '닫기', fontDec: '글자 작게', fontInc: '글자 크게', exportMd: '노트를 Markdown으로 내보내기', searchLoading: '검색 중…', loadingPdf: 'PDF 불러오는 중…', uploadFailed: '업로드 실패', searchOriginal: '원문 위치 검색 중…', unknownPaper: '제목 없음', newPaper: '새 논문', clickAnalyze: '「논문 분석」을 클릭해<br>AI 분석을 시작하세요', openAnalyze: '논문을 열고<br>「논문 분석」을 클릭하세요', researchPh: '내 연구 주제는…' },
    labels: {
      currentMethod: '분석 방식', coreQuestion: '핵심 질문', coreConclusion: '핵심 결론',
      argumentRoute: '논증 흐름', evidenceChain: '근거 사슬', conceptNodes: '개념 노드', readingPath: '읽기 경로',
      noEvidence: '근거 사슬이 없습니다. 다시 분석하거나 인용을 보완하세요.', noConcepts: '개념 노드 없음', noReadingPath: '읽기 경로 없음',
      verified: '✓ 원문에서 확인됨', unverified: '⚠ 원문에서 찾지 못함', notChecked: '○ 미검토',
      evidenceCheck: '근거 확인', found: '개 원문 확인', notFound: '개 찾지 못함', unchecked: '개 미검토',
      scannedWarn: '참고: PDF 텍스트 추출량이 적어 스캔본 검증 신뢰도가 낮을 수 있습니다.',
      keyInsight: '핵심 발견', worthNoting: '주의할 점', keyQuotes: '핵심 원문 인용', readingAdvice: '읽기 제안', vocab: '핵심 용어',
      contributions: '핵심 기여', researchMethod: '연구 방법', keyResults: '주요 결과', limitsFuture: '한계와 후속 연구',
      authorAdmits: '저자가 인정한 한계', blindSpot: '잠재적 맹점', innovationEval: '혁신성 평가', methodIssues: '방법 문제',
      hardWeaknesses: '주요 약점', citationAdvice: '인용 제안', transfer: '방법 이전 분석', gaps: '연구 공백',
      experimentIdeas: '연구 아이디어', furtherKeywords: '후속 읽기 키워드', unknownTitle: '제목 없음',
      problem: '문제', method: '방법', finding: '발견', conclusion: '결론',
      modeLiterature: '문헌 노트 초점', modeReview: '심사 관점 초점', modeResearch: '연구 주제 확장 초점',
      modeQuestion: '질문 중심 읽기 초점', modeDeep: '정독 가이드 초점'
    }
  };

  // ━━━ fr (Français) — native ui / intents / labels ━━━━━━━━━━━━━━━━━━━━━━
  I18N.fr = {
    ui: {
      title: 'PaperKnowKnow', open_paper: 'Ouvrir', analyze_btn: 'Analyser',
      no_file: 'Aucun fichier ouvert', sidebar_label: 'Guide', export_btn: '↓ Exporter',
      analyzing: "L'IA analyse…",
      empty_state: "Ouvrez un article puis cliquez<br>sur « Analyser »",
      drop_zone: "Déposez un PDF ou cliquez sur « Ouvrir »",
      copy: 'Copier', add_note: 'Ajouter une note', add_note_ph: 'Ajouter une note…',
      cancel: 'Annuler', save_note: 'Enregistrer',
      search_ph: 'Rechercher dans le PDF…', search_no_result: 'Aucun résultat',
      learn_lang: 'Apprentissage', library: '📚 Bibliothèque', settings: '⚙ Paramètres',
      toast_note_saved: 'Note enregistrée', toast_copied: 'Copié dans le presse-papiers',
      toast_lib_saved: 'Analyse sauvegardée', toast_lib_loaded: 'Chargé depuis la bibliothèque',
      toast_deleted: 'Supprimé', toast_notes_exported: 'Notes exportées en Markdown',
      toast_md_done: 'Fichier MD téléchargé', toast_need_api_key: 'Veuillez configurer la clé API dans les paramètres',
      toast_need_pdf: 'Veuillez ouvrir un PDF', toast_found_page: 'Trouvé à la page {n}',
      toast_no_match: 'Texte non trouvé dans ce PDF (essayez Ctrl+F)',
      toast_analyze_failed: "Échec de l'analyse : ", toast_ocr_done: 'OCR terminé, vous pouvez rechercher',
      toast_load_failed: 'Erreur de chargement : ', toast_md_failed: 'Échec de la conversion : ',
      toast_export_first: "Analysez le document avant d'exporter", toast_need_api_key2: 'Remplissez la clé API dans les paramètres',
      toast_no_scanned: 'Aucune page numérisée détectée',
      page_label: 'Page {n}', new_tab: 'Nouvel article',
      settings_title: 'Paramètres', intent_title: "Démarrer l'analyse",
      intent_purpose: 'Votre objectif de lecture',
      intent_question_ph: 'Je veux en savoir plus sur…',
      intent_tip: 'Survolez les options à gauche pour plus de détails',
      intent_confirm: 'Démarrer',
      lib_title: '📚 Bibliothèque', lib_search_ph: 'Rechercher des titres…',
      lib_empty: 'Aucun article enregistré', lib_loading: 'Chargement…', lib_failed: 'Échec du chargement',
      lib_no_match: 'Aucun article correspondant',
      validate_btn: 'Valider', validate_btn_ing: 'Validation…', validate_fill: 'Veuillez saisir la clé API',
      validate_failed: 'Validation échouée', validate_server: 'Impossible de se connecter au serveur',
      save_btn: 'Enregistrer', api_key_ph: 'Collez votre clé API…',
      converting: 'Conversion…', search_count: '{a} / {b}',
      toast_search_failed: 'Recherche échouée', settings_saved: 'Paramètres enregistrés',
      api_local_note: 'Stocké localement dans le navigateur, jamais envoyé',
      output_lang_note: "L'analyse IA sera traduite dans cette langue quelle que soit la langue du document",
      label_provider: 'Fournisseur IA', label_apikey: 'Clé API',
      label_output_lang: 'Langue de sortie', label_model: 'Modèle',
      label_model_opt: '(laisser vide pour défaut)', model_ph: 'ex. claude-sonnet-4-6, gpt-4o…',
      tab_new_title: 'Nouvel onglet', learnlang_tooltip: "Activé, l'IA extrait 5 à 8 termes clés avec vocabulaire original, traduction et définition. Utile pour les documents en langue étrangère. Consomme quelques tokens supplémentaires.",
      expand_full: 'Afficher l’analyse complète', collapse_full: 'Masquer l’analyse complète',
      mismatch: 'La langue de sortie ({out}) diffère de la langue d’interface ({ui}). Continuer ?',
      pdf_locate: 'Trouver dans le PDF', lines_label: 'lignes {r}'
    },
    intents: {
      quick:      { title: 'Lecture rapide', badge: 'survol', desc: 'Saisir la question, la conclusion et l’enjeu en premier', body: 'Compresser l’article en une lecture à haut signal : ce qu’il demande, ce qu’il répond, et pourquoi cela compte.\n\nIdéal quand vous ne lirez peut-être pas l’article complet.\n\nSortie : question centrale · conclusion clé · 3-5 points · chemin de lecture minimal.' },
      deep:       { title: 'Guide de lecture approfondie', badge: 'guide', desc: 'Préparer la lecture approfondie : itinéraire et pages clés', body: 'Préparation avant la lecture approfondie : comment l’auteur entre dans le problème, construit l’argument, et quelles pages méritent une lecture lente.\n\nSortie : itinéraire argumentatif · points de bascule · pages clés · conseils de lecture.' },
      question:   { title: 'Lecture orientée question', badge: 'Q-R', desc: 'Utiliser votre question pour trouver réponses, preuves et limites', body: 'Partir de votre question concrète : y répondre, montrer les preuves de l’article, et clarifier ce que l’article ne prouve pas.\n\nIdéal quand vous savez ce que vous cherchez.' },
      deep_notes: { title: 'Notes bibliographiques', badge: 'profond', desc: 'Extraire la structure d’argumentation, la méthode et les résultats', body: 'Créer des notes de recherche réutilisables :\n\n• Contributions\n• Problème et hypothèses\n• Flux méthodologique\n• Résultats clés\n• Limites et travaux futurs.' },
      critical:   { title: 'Regard de relecteur', badge: 'relecture', desc: 'Évaluer contribution, preuves, méthodes et faiblesses', body: 'Agir comme un relecteur juste mais exigeant : reconnaître la contribution, puis vérifier si preuves et méthodes la soutiennent.\n\nUtile pour les vérifications de crédibilité et la sélection de littérature.' },
      research:   { title: 'Direction de recherche', badge: 'recherche', desc: 'Trouver des lacunes, méthodes transférables et angles de sujet', body: 'Relier cet article à votre propre sujet de recherche : méthodes transférables, lacunes non résolues, directions actionnables.\n\nNécessite votre sujet de recherche.' }
    },
    know:     Object.assign({}, I18N.en.know,     { topic: 'Dialogue papier', select: 'Choisir un mode', chat: 'Questions', check: 'Vérifier la compréhension', start: 'Démarrer', done: 'Terminé', close: 'Fermer', send: 'Envoyer ›', summary: 'Résumé', clarify: 'Point à clarifier', cont: 'Continuer' }),
    lib:      Object.assign({}, I18N.en.lib,      { organize: 'Organiser', export: 'Exporter', open: 'Ouvrir', delete: 'Supprimer', addTag: '+ tag', savedAt: 'enregistré le' }),
    settings: Object.assign({}, I18N.en.settings, { maxChars: 'Longueur max d’analyse : ', chars: 'caractères', valid: '✓ API Key valide' }),
    doc:      Object.assign({}, I18N.en.doc,      { title: 'État du document' }),
    misc:     I18N.en.misc,
    labels: {
      currentMethod: 'Méthode d’analyse', coreQuestion: 'Question centrale', coreConclusion: 'Conclusion centrale',
      argumentRoute: 'Itinéraire argumentatif', evidenceChain: 'Chaîne de preuves', conceptNodes: 'Nœuds conceptuels', readingPath: 'Chemin de lecture',
      noEvidence: 'Pas encore de chaîne de preuves. Réanalysez ou ajoutez des citations.', noConcepts: 'Pas encore de nœuds conceptuels', noReadingPath: 'Pas encore de chemin de lecture.',
      verified: '✓ Vérifié dans la source', unverified: '⚠ Non trouvé dans la source', notChecked: '○ Non vérifié',
      evidenceCheck: 'Vérification des preuves', found: 'trouvé(es) dans la source', notFound: 'introuvable(s)', unchecked: 'non vérifié(es)',
      scannedWarn: 'Note : l’extraction de texte du PDF est faible, la vérification est moins fiable pour les articles numérisés.',
      keyInsight: 'Aperçu clé', worthNoting: 'À noter', keyQuotes: 'Citations clés du texte', readingAdvice: 'Conseils de lecture', vocab: 'Termes clés',
      contributions: 'Contributions principales', researchMethod: 'Méthode de recherche', keyResults: 'Résultats clés', limitsFuture: 'Limites et travaux futurs',
      authorAdmits: 'L’auteur admet', blindSpot: 'Angle mort potentiel', innovationEval: 'Évaluation de l’innovation', methodIssues: 'Problèmes de méthode',
      hardWeaknesses: 'Faiblesses principales', citationAdvice: 'Note sur les citations', transfer: 'Analyse de transfert de méthode', gaps: 'Lacunes de recherche',
      experimentIdeas: 'Idées de recherche', furtherKeywords: 'Mots-clés pour aller plus loin', unknownTitle: 'Titre inconnu',
      problem: 'Problème', method: 'Méthode', finding: 'Découverte', conclusion: 'Conclusion',
      modeLiterature: 'Focus Notes bibliographiques', modeReview: 'Focus Regard de relecteur', modeResearch: 'Focus Direction de recherche',
      modeQuestion: 'Focus Lecture orientée question', modeDeep: 'Focus Lecture approfondie'
    }
  };

  // ━━━ de (Deutsch) — native ui / intents / labels ━━━━━━━━━━━━━━━━━━━━━━━
  I18N.de = {
    ui: {
      title: 'PaperKnowKnow', open_paper: 'Öffnen', analyze_btn: 'Analysieren',
      no_file: 'Keine Datei geöffnet', sidebar_label: 'Leitfaden', export_btn: '↓ Exportieren',
      analyzing: 'KI analysiert…',
      empty_state: 'Öffnen Sie ein Paper und klicken<br>Sie auf „Analysieren"',
      drop_zone: 'PDF hineinziehen oder auf „Öffnen" klicken',
      copy: 'Kopieren', add_note: 'Notiz hinzufügen', add_note_ph: 'Notiz hinzufügen…',
      cancel: 'Abbrechen', save_note: 'Notiz speichern',
      search_ph: 'Im PDF suchen…', search_no_result: 'Keine Ergebnisse',
      learn_lang: 'Sprachlernen', library: '📚 Bibliothek', settings: '⚙ Einstellungen',
      toast_note_saved: 'Notiz gespeichert', toast_copied: 'In Zwischenablage kopiert',
      toast_lib_saved: 'Analyse in Bibliothek gespeichert', toast_lib_loaded: 'Aus Bibliothek geladen',
      toast_deleted: 'Gelöscht', toast_notes_exported: 'Notizen als Markdown exportiert',
      toast_md_done: 'MD-Datei heruntergeladen', toast_need_api_key: 'Bitte API-Schlüssel in Einstellungen konfigurieren',
      toast_need_pdf: 'Bitte zuerst ein PDF öffnen', toast_found_page: 'Auf Seite {n} gefunden',
      toast_no_match: 'Text nicht im aktuellen PDF gefunden (versuchen Sie Ctrl+F)',
      toast_analyze_failed: 'Analyse fehlgeschlagen: ', toast_ocr_done: 'OCR abgeschlossen, Suche möglich',
      toast_load_failed: 'Ladefehler: ', toast_md_failed: 'Konvertierungsfehler: ',
      toast_export_first: 'Bitte zuerst das Dokument analysieren', toast_need_api_key2: 'Bitte API-Schlüssel in Einstellungen eingeben',
      toast_no_scanned: 'Keine gescannten Seiten erkannt',
      page_label: 'Seite {n}', new_tab: 'Neues Paper',
      settings_title: 'Einstellungen', intent_title: 'Analyse starten',
      intent_purpose: 'Ihr Leseziel',
      intent_question_ph: 'Ich möchte wissen…',
      intent_tip: 'Bewegen Sie den Mauszeiger über die Optionen für Details',
      intent_confirm: 'Starten',
      lib_title: '📚 Bibliothek', lib_search_ph: 'Titel suchen…',
      lib_empty: 'Keine gespeicherten Paper', lib_loading: 'Laden…', lib_failed: 'Ladefehler',
      lib_no_match: 'Keine passenden Paper',
      validate_btn: 'Überprüfen', validate_btn_ing: 'Wird überprüft…', validate_fill: 'Bitte API-Schlüssel eingeben',
      validate_failed: 'Überprüfung fehlgeschlagen', validate_server: 'Serververbindung fehlgeschlagen',
      save_btn: 'Speichern', api_key_ph: 'API-Schlüssel einfügen…',
      converting: 'Konvertierung…', search_count: '{a} / {b}',
      toast_search_failed: 'Suche fehlgeschlagen', settings_saved: 'Einstellungen gespeichert',
      api_local_note: 'Nur lokal im Browser gespeichert, nie hochgeladen',
      output_lang_note: 'KI-Analyse wird in diese Sprache übersetzt, unabhängig von der Dokumentsprache',
      label_provider: 'KI-Anbieter', label_apikey: 'API-Schlüssel',
      label_output_lang: 'Ausgabesprache', label_model: 'Modell',
      label_model_opt: '(leer lassen für Standard)', model_ph: 'z.B. claude-sonnet-4-6, gpt-4o…',
      tab_new_title: 'Neuer Tab', learnlang_tooltip: 'Wenn aktiviert, extrahiert die KI 5–8 Schlüsselbegriffe mit Originalvokabular, Übersetzung und Definition. Nützlich beim Lesen fremdsprachiger Dokumente. Verbraucht geringe zusätzliche Token.',
      expand_full: 'Vollständige Analyse anzeigen', collapse_full: 'Vollständige Analyse ausblenden',
      mismatch: 'Ausgabesprache ({out}) unterscheidet sich von der Oberfläche ({ui}). Fortfahren?',
      pdf_locate: 'Im PDF finden', lines_label: 'Zeilen {r}'
    },
    intents: {
      quick:      { title: 'Schnelllesen', badge: 'Überflug', desc: 'Frage, Schlussfolgerung und Bedeutung zuerst erfassen', body: 'Das Paper in eine signalreiche Lesung verdichten: was es fragt, was es beantwortet, und warum es wichtig ist.\n\nIdeal, wenn Sie das ganze Paper vielleicht nicht lesen werden.\n\nAusgabe: Kernfrage · zentrale Schlussfolgerung · 3-5 Erkenntnisse · minimaler Lesepfad.' },
      deep:       { title: 'Leitfaden für Detail-Lektüre', badge: 'Leitfaden', desc: 'Argumentationsroute und Schlüsselseiten vor der Detail-Lektüre', body: 'Vorbereitung vor der Detail-Lektüre: wie der Autor das Problem angeht, die Argumentation aufbaut, und wo die langsam zu lesenden Seiten sind.\n\nAusgabe: Argumentationsroute · Wendepunkte · Schlüsselseiten · Lesetipps.' },
      question:   { title: 'Fragenorientiertes Lesen', badge: 'F&A', desc: 'Mit Ihrer Frage Antworten, Belege und Grenzen finden', body: 'Beginnen Sie mit Ihrer konkreten Frage: beantworten Sie sie, zeigen Sie die Belege aus dem Paper, und klären Sie, was das Paper nicht beweist.\n\nIdeal, wenn Sie wissen, was Sie aus dem Paper wollen.' },
      deep_notes: { title: 'Literaturnotizen', badge: 'tief', desc: 'Argumentationsstruktur, Methode und Ergebnisse extrahieren', body: 'Wiederverwendbare Forschungsnotizen erstellen:\n\n• Beiträge\n• Problemstellung und Annahmen\n• Methodenfluss\n• Schlüsselergebnisse\n• Grenzen und Zukunftsarbeit.' },
      critical:   { title: 'Gutachterperspektive', badge: 'Gutachten', desc: 'Beitrag, Belege, Methoden und Schwächen bewerten', body: 'Als fairer aber anspruchsvoller Gutachter handeln: den Beitrag anerkennen, dann prüfen, ob Belege und Methode ihn stützen.\n\nGeeignet für Glaubwürdigkeitsprüfungen und Literaturauswahl.' },
      research:   { title: 'Forschungsrichtung', badge: 'Forschung', desc: 'Lücken, übertragbare Methoden und Themenwinkel finden', body: 'Dieses Paper mit Ihrem eigenen Forschungsthema verknüpfen: übertragbare Methoden, ungelöste Lücken, umsetzbare Richtungen.\n\nErfordert Ihr Forschungsthema.' }
    },
    know:     Object.assign({}, I18N.en.know,     { topic: 'Paper-Dialog', select: 'Modus wählen', chat: 'Fragen', check: 'Verständnis prüfen', start: 'Start', done: 'Fertig', close: 'Schließen', send: 'Senden ›', summary: 'Zusammenfassung', clarify: 'Zu klären', cont: 'Weiter' }),
    lib:      Object.assign({}, I18N.en.lib,      { organize: 'Organisieren', export: 'Exportieren', open: 'Öffnen', delete: 'Löschen', addTag: '+ Tag', savedAt: 'gespeichert am' }),
    settings: Object.assign({}, I18N.en.settings, { maxChars: 'Max. Analyselänge: ', chars: 'Zeichen', valid: '✓ API Key gültig' }),
    doc:      Object.assign({}, I18N.en.doc,      { title: 'Dokumentenprüfung' }),
    misc:     I18N.en.misc,
    labels: {
      currentMethod: 'Analysemethode', coreQuestion: 'Kernfrage', coreConclusion: 'Zentrale Schlussfolgerung',
      argumentRoute: 'Argumentationsroute', evidenceChain: 'Belegkette', conceptNodes: 'Konzeptknoten', readingPath: 'Lesepfad',
      noEvidence: 'Noch keine Belegkette. Erneut analysieren oder Zitate ergänzen.', noConcepts: 'Noch keine Konzeptknoten', noReadingPath: 'Noch kein Lesepfad.',
      verified: '✓ Im Originaltext bestätigt', unverified: '⚠ Im Originaltext nicht gefunden', notChecked: '○ Nicht geprüft',
      evidenceCheck: 'Belegprüfung', found: 'im Originaltext gefunden', notFound: 'nicht gefunden', unchecked: 'nicht geprüft',
      scannedWarn: 'Hinweis: Textextraktion aus PDF ist gering, die Verifizierung ist bei gescannten Papern weniger zuverlässig.',
      keyInsight: 'Kerneinsicht', worthNoting: 'Beachtenswert', keyQuotes: 'Wichtige Originalzitate', readingAdvice: 'Lesehinweise', vocab: 'Schlüsselbegriffe',
      contributions: 'Kernbeiträge', researchMethod: 'Forschungsmethode', keyResults: 'Schlüsselergebnisse', limitsFuture: 'Grenzen und Zukunftsarbeit',
      authorAdmits: 'Der Autor räumt ein', blindSpot: 'Potenzieller blinder Fleck', innovationEval: 'Innovationsbewertung', methodIssues: 'Methodische Probleme',
      hardWeaknesses: 'Hauptschwächen', citationAdvice: 'Zitierhinweise', transfer: 'Analyse zur Methodenübertragung', gaps: 'Forschungslücken',
      experimentIdeas: 'Forschungsideen', furtherKeywords: 'Schlüsselbegriffe für weiterführende Lektüre', unknownTitle: 'Unbekannter Titel',
      problem: 'Problem', method: 'Methode', finding: 'Ergebnis', conclusion: 'Schlussfolgerung',
      modeLiterature: 'Fokus Literaturnotizen', modeReview: 'Fokus Gutachterperspektive', modeResearch: 'Fokus Forschungsrichtung',
      modeQuestion: 'Fokus Fragenorientiertes Lesen', modeDeep: 'Fokus Detail-Lektüre'
    }
  };

  // ━━━ es (Español) — native ui / intents / labels ━━━━━━━━━━━━━━━━━━━━━━━
  I18N.es = {
    ui: {
      title: 'PaperKnowKnow', open_paper: 'Abrir', analyze_btn: 'Analizar',
      no_file: 'Sin archivo abierto', sidebar_label: 'Guía', export_btn: '↓ Exportar',
      analyzing: 'IA analizando…',
      empty_state: 'Abra un artículo y haga<br>clic en «Analizar»',
      drop_zone: 'Suelte un PDF o haga clic en «Abrir»',
      copy: 'Copiar', add_note: 'Agregar nota', add_note_ph: 'Agregar nota…',
      cancel: 'Cancelar', save_note: 'Guardar nota',
      search_ph: 'Buscar en PDF…', search_no_result: 'Sin resultados',
      learn_lang: 'Aprendizaje', library: '📚 Biblioteca', settings: '⚙ Configuración',
      toast_note_saved: 'Nota guardada', toast_copied: 'Copiado al portapapeles',
      toast_lib_saved: 'Análisis guardado en la biblioteca', toast_lib_loaded: 'Cargado desde la biblioteca',
      toast_deleted: 'Eliminado', toast_notes_exported: 'Notas exportadas como Markdown',
      toast_md_done: 'Archivo MD descargado', toast_need_api_key: 'Configure la clave API en Configuración primero',
      toast_need_pdf: 'Abra un PDF primero', toast_found_page: 'Encontrado en la página {n}',
      toast_no_match: 'Texto no encontrado en el PDF actual (intente Ctrl+F)',
      toast_analyze_failed: 'Error de análisis: ', toast_ocr_done: 'OCR completado, puede buscar ahora',
      toast_load_failed: 'Error de carga: ', toast_md_failed: 'Error de conversión: ',
      toast_export_first: 'Analice el documento antes de exportar', toast_need_api_key2: 'Ingrese la clave API en Configuración',
      toast_no_scanned: 'No se detectaron páginas escaneadas',
      page_label: 'Página {n}', new_tab: 'Nuevo artículo',
      settings_title: 'Configuración', intent_title: 'Iniciar análisis',
      intent_purpose: 'Su objetivo de lectura',
      intent_question_ph: 'Quiero saber sobre…',
      intent_tip: 'Pase el cursor sobre las opciones para ver detalles',
      intent_confirm: 'Iniciar',
      lib_title: '📚 Biblioteca', lib_search_ph: 'Buscar títulos…',
      lib_empty: 'No hay artículos guardados', lib_loading: 'Cargando…', lib_failed: 'Error de carga',
      lib_no_match: 'No hay artículos que coincidan',
      validate_btn: 'Validar', validate_btn_ing: 'Validando…', validate_fill: 'Ingrese la clave API primero',
      validate_failed: 'Validación fallida', validate_server: 'No se puede conectar al servidor',
      save_btn: 'Guardar', api_key_ph: 'Pegue su clave API…',
      converting: 'Convirtiendo…', search_count: '{a} / {b}',
      toast_search_failed: 'Búsqueda fallida', settings_saved: 'Configuración guardada',
      api_local_note: 'Almacenado localmente en el navegador, nunca enviado',
      output_lang_note: 'El análisis de IA se traducirá a este idioma independientemente del idioma del documento',
      label_provider: 'Proveedor IA', label_apikey: 'Clave API',
      label_output_lang: 'Idioma de salida', label_model: 'Modelo',
      label_model_opt: '(dejar vacío para predeterminado)', model_ph: 'ej. claude-sonnet-4-6, gpt-4o…',
      tab_new_title: 'Nueva pestaña', learnlang_tooltip: 'Cuando está activado, la IA extrae 5-8 términos clave con vocabulario original, traducción y definición. Útil para leer documentos en idiomas extranjeros. Consume pocos tokens adicionales.',
      expand_full: 'Mostrar análisis completo', collapse_full: 'Ocultar análisis completo',
      mismatch: 'El idioma de salida ({out}) difiere del idioma de interfaz ({ui}). ¿Continuar?',
      pdf_locate: 'Buscar en PDF', lines_label: 'líneas {r}'
    },
    intents: {
      quick:      { title: 'Lectura rápida', badge: 'rápido', desc: 'Capte la pregunta, conclusión y significado primero', body: 'Comprime el artículo en una lectura de alto valor: qué pregunta, qué responde, y por qué importa.\n\nIdeal cuando quizás no leerá el artículo completo.\n\nSalida: pregunta central · conclusión clave · 3-5 puntos · ruta de lectura mínima.' },
      deep:       { title: 'Guía de lectura detallada', badge: 'guía', desc: 'Ruta argumentativa y páginas clave antes de la lectura detallada', body: 'Preparación antes de la lectura detallada: cómo el autor entra en el problema, construye el argumento, y qué páginas merecen lectura lenta.\n\nSalida: ruta argumentativa · puntos de inflexión · páginas clave · consejos de lectura.' },
      question:   { title: 'Lectura guiada por pregunta', badge: 'P-R', desc: 'Use su pregunta para encontrar respuestas, evidencia y límites', body: 'Comience con su pregunta concreta: respóndala, muestre la evidencia del artículo, y aclare lo que el artículo no prueba.\n\nIdeal cuando sabe lo que busca del artículo.' },
      deep_notes: { title: 'Notas bibliográficas', badge: 'profundo', desc: 'Extraer estructura argumentativa, método y resultados', body: 'Crear notas de investigación reutilizables:\n\n• Contribuciones\n• Problema y suposiciones\n• Flujo metodológico\n• Resultados clave\n• Limitaciones y trabajo futuro.' },
      critical:   { title: 'Perspectiva de revisor', badge: 'revisión', desc: 'Evaluar contribución, evidencia, métodos y debilidades', body: 'Actuar como revisor justo pero exigente: reconocer la contribución, luego verificar si evidencia y método la respaldan.\n\nÚtil para verificar credibilidad y filtrar literatura.' },
      research:   { title: 'Dirección de investigación', badge: 'investigación', desc: 'Encontrar vacíos, métodos transferibles y ángulos temáticos', body: 'Conectar este artículo con su propio tema de investigación: métodos transferibles, vacíos no resueltos, direcciones accionables.\n\nRequiere su tema de investigación.' }
    },
    know:     Object.assign({}, I18N.en.know,     { topic: 'Diálogo del artículo', select: 'Elegir modo', chat: 'Preguntas', check: 'Comprobar comprensión', start: 'Iniciar', done: 'Listo', close: 'Cerrar', send: 'Enviar ›', summary: 'Resumen', clarify: 'Punto por aclarar', cont: 'Continuar' }),
    lib:      Object.assign({}, I18N.en.lib,      { organize: 'Organizar', export: 'Exportar', open: 'Abrir', delete: 'Eliminar', addTag: '+ etiqueta', savedAt: 'guardado el' }),
    settings: Object.assign({}, I18N.en.settings, { maxChars: 'Longitud máxima: ', chars: 'caracteres', valid: '✓ API Key válida' }),
    doc:      Object.assign({}, I18N.en.doc,      { title: 'Revisión del documento' }),
    misc:     I18N.en.misc,
    labels: {
      currentMethod: 'Método de análisis', coreQuestion: 'Pregunta central', coreConclusion: 'Conclusión central',
      argumentRoute: 'Ruta argumentativa', evidenceChain: 'Cadena de evidencia', conceptNodes: 'Nodos conceptuales', readingPath: 'Ruta de lectura',
      noEvidence: 'Aún no hay cadena de evidencia. Reanalice o agregue citas.', noConcepts: 'Aún no hay nodos conceptuales', noReadingPath: 'Aún no hay ruta de lectura.',
      verified: '✓ Verificado en la fuente', unverified: '⚠ No encontrado en la fuente', notChecked: '○ Sin verificar',
      evidenceCheck: 'Verificación de evidencia', found: 'encontrado(s) en la fuente', notFound: 'no encontrado(s)', unchecked: 'sin verificar',
      scannedWarn: 'Nota: la extracción de texto del PDF es escasa, la verificación es menos fiable para artículos escaneados.',
      keyInsight: 'Hallazgo clave', worthNoting: 'A destacar', keyQuotes: 'Citas clave del texto', readingAdvice: 'Consejos de lectura', vocab: 'Términos clave',
      contributions: 'Contribuciones principales', researchMethod: 'Método de investigación', keyResults: 'Resultados clave', limitsFuture: 'Limitaciones y trabajo futuro',
      authorAdmits: 'El autor admite', blindSpot: 'Punto ciego potencial', innovationEval: 'Evaluación de la innovación', methodIssues: 'Problemas metodológicos',
      hardWeaknesses: 'Debilidades principales', citationAdvice: 'Nota sobre citación', transfer: 'Análisis de transferencia de método', gaps: 'Vacíos de investigación',
      experimentIdeas: 'Ideas de investigación', furtherKeywords: 'Palabras clave para lecturas adicionales', unknownTitle: 'Título desconocido',
      problem: 'Problema', method: 'Método', finding: 'Hallazgo', conclusion: 'Conclusión',
      modeLiterature: 'Enfoque Notas bibliográficas', modeReview: 'Enfoque Perspectiva de revisor', modeResearch: 'Enfoque Dirección de investigación',
      modeQuestion: 'Enfoque Lectura guiada por pregunta', modeDeep: 'Enfoque Lectura detallada'
    }
  };

  // ━━━ vi (Tiếng Việt) — native ui / intents / labels ━━━━━━━━━━━━━━━━━━━━
  I18N.vi = {
    ui: {
      title: 'PaperKnowKnow', open_paper: 'Mở bài báo', analyze_btn: 'Phân tích',
      no_file: 'Chưa mở file', sidebar_label: 'Hướng dẫn', export_btn: '↓ Xuất',
      analyzing: 'AI đang phân tích…',
      empty_state: 'Mở bài báo rồi nhấn<br>«Phân tích» để xem',
      drop_zone: 'Kéo PDF vào hoặc nhấn «Mở bài báo»',
      copy: 'Sao chép', add_note: 'Thêm ghi chú', add_note_ph: 'Thêm ghi chú…',
      cancel: 'Hủy', save_note: 'Lưu ghi chú',
      search_ph: 'Tìm kiếm trong PDF…', search_no_result: 'Không có kết quả',
      learn_lang: 'Học ngôn ngữ', library: '📚 Thư viện', settings: '⚙ Cài đặt',
      toast_note_saved: 'Đã lưu ghi chú', toast_copied: 'Đã sao chép vào clipboard',
      toast_lib_saved: 'Đã lưu phân tích vào thư viện', toast_lib_loaded: 'Đã tải từ thư viện',
      toast_deleted: 'Đã xóa', toast_notes_exported: 'Đã xuất ghi chú sang Markdown',
      toast_md_done: 'Đã tải xuống file MD', toast_need_api_key: 'Vui lòng cấu hình API Key trong Cài đặt trước',
      toast_need_pdf: 'Vui lòng mở PDF trước', toast_found_page: 'Tìm thấy ở trang {n}',
      toast_no_match: 'Không tìm thấy văn bản trong PDF này (thử Ctrl+F thủ công)',
      toast_analyze_failed: 'Phân tích thất bại: ', toast_ocr_done: 'OCR hoàn tất, bạn có thể tìm kiếm',
      toast_load_failed: 'Tải thất bại: ', toast_md_failed: 'Chuyển đổi thất bại: ',
      toast_export_first: 'Vui lòng phân tích bài báo trước khi xuất', toast_need_api_key2: 'Vui lòng nhập API Key vào Cài đặt',
      toast_no_scanned: 'Không phát hiện trang quét',
      page_label: 'Trang {n}', new_tab: 'Bài báo mới',
      settings_title: 'Cài đặt', intent_title: 'Bắt đầu phân tích',
      intent_purpose: 'Mục đích đọc của bạn',
      intent_question_ph: 'Tôi muốn biết về…',
      intent_tip: 'Di chuột qua các tùy chọn bên trái để xem chi tiết',
      intent_confirm: 'Bắt đầu',
      lib_title: '📚 Thư viện', lib_search_ph: 'Tìm kiếm tiêu đề…',
      lib_empty: 'Chưa có bài báo nào được lưu', lib_loading: 'Đang tải…', lib_failed: 'Tải thất bại',
      lib_no_match: 'Không có bài báo nào phù hợp',
      validate_btn: 'Xác thực', validate_btn_ing: 'Đang xác thực…', validate_fill: 'Vui lòng nhập API Key trước',
      validate_failed: 'Xác thực thất bại', validate_server: 'Không thể kết nối đến máy chủ',
      save_btn: 'Lưu', api_key_ph: 'Dán API Key của bạn…',
      converting: 'Đang chuyển đổi…', search_count: '{a} / {b}',
      toast_search_failed: 'Tìm kiếm thất bại', settings_saved: 'Đã lưu cài đặt',
      api_local_note: 'Chỉ lưu cục bộ trong trình duyệt, không tải lên máy chủ',
      output_lang_note: 'Kết quả phân tích AI sẽ được dịch sang ngôn ngữ này bất kể ngôn ngữ của tài liệu',
      label_provider: 'Nhà cung cấp AI', label_apikey: 'API Key',
      label_output_lang: 'Ngôn ngữ đầu ra', label_model: 'Mô hình',
      label_model_opt: '(để trống để dùng mặc định)', model_ph: 'vd. claude-sonnet-4-6, gpt-4o…',
      tab_new_title: 'Tab mới', learnlang_tooltip: 'Khi bật, AI sẽ trích xuất 5-8 thuật ngữ quan trọng kèm từ gốc, bản dịch và định nghĩa. Hữu ích khi đọc tài liệu ngoại ngữ. Tiêu tốn thêm một ít token.',
      expand_full: 'Hiện phân tích đầy đủ', collapse_full: 'Ẩn phân tích đầy đủ',
      mismatch: 'Ngôn ngữ đầu ra ({out}) khác với giao diện ({ui}). Tiếp tục?',
      pdf_locate: 'Tìm trong PDF', lines_label: 'dòng {r}'
    },
    intents: {
      quick:      { title: 'Đọc nhanh', badge: 'lướt', desc: 'Nắm câu hỏi, kết luận và ý nghĩa trước', body: 'Nén bài báo thành bản đọc tín hiệu cao: nó hỏi gì, trả lời gì, và vì sao quan trọng.\n\nLý tưởng khi bạn có thể chưa đọc toàn bộ bài báo.\n\nĐầu ra: câu hỏi cốt lõi · kết luận chính · 3-5 điểm · lộ trình đọc tối thiểu.' },
      deep:       { title: 'Hướng dẫn đọc sâu', badge: 'hướng dẫn', desc: 'Chuẩn bị cho đọc sâu: lộ trình lập luận và trang trọng yếu', body: 'Chuẩn bị trước khi đọc sâu: tác giả vào vấn đề thế nào, xây dựng lập luận ra sao, và những trang nào đáng đọc chậm.\n\nĐầu ra: lộ trình lập luận · điểm chuyển · trang trọng yếu · gợi ý đọc.' },
      question:   { title: 'Đọc theo câu hỏi', badge: 'H-Đ', desc: 'Dùng câu hỏi của bạn để tìm đáp án, bằng chứng và giới hạn', body: 'Bắt đầu từ câu hỏi cụ thể của bạn: trả lời nó, đưa ra bằng chứng từ bài báo, và làm rõ điều bài báo không chứng minh được.\n\nLý tưởng khi bạn biết mình muốn gì từ bài báo.' },
      deep_notes: { title: 'Ghi chú văn liệu', badge: 'sâu', desc: 'Trích xuất cấu trúc lập luận, phương pháp và kết quả', body: 'Tạo ghi chú nghiên cứu có thể tái sử dụng:\n\n• Đóng góp\n• Vấn đề và giả định\n• Quy trình phương pháp\n• Kết quả chính\n• Giới hạn và hướng tương lai.' },
      critical:   { title: 'Góc nhìn phản biện', badge: 'phản biện', desc: 'Đánh giá đóng góp, bằng chứng, phương pháp và điểm yếu', body: 'Hành xử như người bình duyệt công bằng nhưng nghiêm khắc: ghi nhận đóng góp, sau đó kiểm tra xem bằng chứng và phương pháp có ủng hộ nó không.\n\nHữu ích cho kiểm tra độ tin cậy và lọc tài liệu.' },
      research:   { title: 'Hướng nghiên cứu', badge: 'nghiên cứu', desc: 'Tìm khoảng trống, phương pháp chuyển đổi và góc đề tài', body: 'Kết nối bài báo này với chủ đề nghiên cứu của bạn: phương pháp có thể chuyển đổi, khoảng trống chưa giải quyết, hướng đi khả thi.\n\nCần chủ đề nghiên cứu của bạn.' }
    },
    know:     Object.assign({}, I18N.en.know,     { topic: 'Đối thoại bài báo', select: 'Chọn chế độ', chat: 'Hỏi đáp', check: 'Kiểm tra hiểu biết', start: 'Bắt đầu', done: 'Xong', close: 'Đóng', send: 'Gửi ›', summary: 'Tóm tắt', clarify: 'Điểm cần làm rõ', cont: 'Tiếp tục' }),
    lib:      Object.assign({}, I18N.en.lib,      { organize: 'Sắp xếp', export: 'Xuất', open: 'Mở', delete: 'Xóa', addTag: '+ thẻ', savedAt: 'đã lưu lúc' }),
    settings: Object.assign({}, I18N.en.settings, { maxChars: 'Độ dài phân tích tối đa: ', chars: 'ký tự', valid: '✓ API Key hợp lệ' }),
    doc:      Object.assign({}, I18N.en.doc,      { title: 'Kiểm tra tài liệu' }),
    misc:     I18N.en.misc,
    labels: {
      currentMethod: 'Phương pháp phân tích', coreQuestion: 'Câu hỏi cốt lõi', coreConclusion: 'Kết luận cốt lõi',
      argumentRoute: 'Lộ trình lập luận', evidenceChain: 'Chuỗi bằng chứng', conceptNodes: 'Nút khái niệm', readingPath: 'Lộ trình đọc',
      noEvidence: 'Chưa có chuỗi bằng chứng. Hãy phân tích lại hoặc bổ sung trích dẫn.', noConcepts: 'Chưa có nút khái niệm', noReadingPath: 'Chưa có lộ trình đọc.',
      verified: '✓ Xác minh trong nguồn', unverified: '⚠ Không tìm thấy trong nguồn', notChecked: '○ Chưa kiểm tra',
      evidenceCheck: 'Kiểm tra bằng chứng', found: 'tìm thấy trong nguồn', notFound: 'không tìm thấy', unchecked: 'chưa kiểm tra',
      scannedWarn: 'Lưu ý: trích xuất văn bản PDF ít, độ tin cậy xác minh giảm với bài báo quét.',
      keyInsight: 'Phát hiện chính', worthNoting: 'Đáng chú ý', keyQuotes: 'Trích dẫn nguồn chính', readingAdvice: 'Gợi ý đọc', vocab: 'Thuật ngữ chính',
      contributions: 'Đóng góp cốt lõi', researchMethod: 'Phương pháp nghiên cứu', keyResults: 'Kết quả chính', limitsFuture: 'Giới hạn và hướng tương lai',
      authorAdmits: 'Tác giả thừa nhận', blindSpot: 'Điểm mù tiềm ẩn', innovationEval: 'Đánh giá tính đổi mới', methodIssues: 'Vấn đề phương pháp',
      hardWeaknesses: 'Điểm yếu chính', citationAdvice: 'Ghi chú trích dẫn', transfer: 'Phân tích chuyển đổi phương pháp', gaps: 'Khoảng trống nghiên cứu',
      experimentIdeas: 'Ý tưởng nghiên cứu', furtherKeywords: 'Từ khóa đọc thêm', unknownTitle: 'Tiêu đề không xác định',
      problem: 'Vấn đề', method: 'Phương pháp', finding: 'Phát hiện', conclusion: 'Kết luận',
      modeLiterature: 'Trọng tâm Ghi chú văn liệu', modeReview: 'Trọng tâm Góc nhìn phản biện', modeResearch: 'Trọng tâm Hướng nghiên cứu',
      modeQuestion: 'Trọng tâm Đọc theo câu hỏi', modeDeep: 'Trọng tâm Đọc sâu'
    }
  };

  // ─── State & helpers ────────────────────────────────────────────────────
  if (global._uiLang === undefined) global._uiLang = 'zh';

  function resolvePath(obj, path) {
    if (obj == null) return undefined;
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function applyVars(s, vars) {
    if (vars == null || typeof s !== 'string') return s;
    return s.replace(/\{(\w+)\}/g, function (_, k) {
      return (vars[k] !== undefined && vars[k] !== null) ? vars[k] : '';
    });
  }

  // t(key, vars?)  — supports flat keys (legacy, look in pack.ui) AND dotted paths.
  // Fallback chain: current lang → en → zh → return key string as-is.
  function t(key, vars) {
    var lang = global._uiLang;
    var cur = I18N[lang] || I18N.zh;
    var val;
    if (key.indexOf('.') >= 0) {
      val = resolvePath(cur, key);
      if (val == null) val = resolvePath(I18N.en, key);
      if (val == null) val = resolvePath(I18N.zh, key);
    } else {
      val = cur.ui && cur.ui[key];
      if (val == null) val = I18N.en && I18N.en.ui && I18N.en.ui[key];
      if (val == null) val = I18N.zh && I18N.zh.ui && I18N.zh.ui[key];
    }
    if (val == null) return key;
    return applyVars(val, vars);
  }

  // lab(key) — back-compat shim for the old app.js helper.
  function lab(key) {
    var cur = I18N[global._uiLang] || I18N.zh;
    return (cur.labels && cur.labels[key]) ||
           (I18N.en.labels && I18N.en.labels[key]) ||
           (I18N.zh.labels && I18N.zh.labels[key]) ||
           key;
  }

  // ui() — back-compat shim. Returns the current pack object so existing
  // call sites like ui().intents.quick.title keep working unchanged.
  function ui() {
    return I18N[global._uiLang] || I18N.en || I18N.zh;
  }

  // fillVars(s, vars) — exposed for any code that needs raw placeholder filling.
  function fillVars(s, vars) {
    return applyVars(String(s == null ? '' : s), vars || {});
  }

  // ─── Expose globals (consumed by app.js) ───────────────────────────────
  global.LANG_CODE    = LANG_CODE;
  global.LANG_DISPLAY = LANG_DISPLAY;
  global.I18N         = I18N;
  global.t            = t;
  global.lab          = lab;
  global.ui           = ui;
  global.fillVars     = fillVars;

  // ─── Startup self-check ────────────────────────────────────────────────
  // Warns once in DevTools if any language is missing keys that zh has.
  // Safe: catches all errors so it never blocks app boot.
  try {
    var flatten = function (o, prefix) {
      var out = {};
      if (!o || typeof o !== 'object') return out;
      var keys = Object.keys(o);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var p = prefix ? (prefix + '.' + k) : k;
        var v = o[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          var sub = flatten(v, p);
          for (var sk in sub) if (Object.prototype.hasOwnProperty.call(sub, sk)) out[sk] = sub[sk];
        } else {
          out[p] = v;
        }
      }
      return out;
    };
    var refKeys = Object.keys(flatten(I18N.zh));
    var langs = Object.keys(I18N);
    for (var li = 0; li < langs.length; li++) {
      var lcode = langs[li];
      if (lcode === 'zh') continue;
      var curFlat = flatten(I18N[lcode]);
      var missing = [];
      for (var ki = 0; ki < refKeys.length; ki++) {
        if (curFlat[refKeys[ki]] === undefined) missing.push(refKeys[ki]);
      }
      if (missing.length) {
        // eslint-disable-next-line no-console
        console.warn('[i18n] ' + lcode + ': missing ' + missing.length + ' key(s) — first 5:', missing.slice(0, 5));
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[i18n] validation skipped:', e);
  }
})(typeof window !== 'undefined' ? window : globalThis);
