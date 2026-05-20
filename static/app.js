'use strict';

// ── PDF.js setup ─────────────────────────────────────────────────────────────
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// CMap needed for CJK (Chinese/Japanese/Korean) characters in PDFs
// unpkg provides direct file access, cdnjs does not serve subdirectories
const CMAP_URL    = 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/';
const CMAP_PACKED = true;

// ── State ─────────────────────────────────────────────────────────────────────
let pdfDoc      = null;
let fileId      = null;
let structure   = null;
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
let depth       = 'brief';
let renderObs   = [];
let _renderGen  = 0;   // incremented on every renderPDF call; stale renders self-abort

// ── UI i18n ───────────────────────────────────────────────────────────────────
const LANG_CODE = {
  'Chinese': 'zh', 'English': 'en', 'Chinese Traditional': 'zh-TW',
  'Japanese': 'ja', 'Korean': 'ko', 'French': 'fr',
  'German': 'de', 'Spanish': 'es', 'Vietnamese': 'vi',
};
const LANG_DISPLAY = {
  'Chinese': '中文（简体）', 'English': 'English', 'Chinese Traditional': '中文（繁體）',
  'Japanese': '日本語', 'Korean': '한국어', 'French': 'Français',
  'German': 'Deutsch', 'Spanish': 'Español', 'Vietnamese': 'Tiếng Việt',
};
let _uiLang = 'zh';

const TRANSLATIONS = {
  zh: {
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
  },
  en: {
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
  },
  'zh-TW': {
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
  },
  ja: {
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
  },
  ko: {
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
  },
  fr: {
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
    toast_analyze_failed: 'Échec de l\'analyse : ', toast_ocr_done: 'OCR terminé, vous pouvez rechercher',
    toast_load_failed: 'Erreur de chargement : ', toast_md_failed: 'Échec de la conversion : ',
    toast_export_first: 'Analysez le document avant d\'exporter', toast_need_api_key2: 'Remplissez la clé API dans les paramètres',
    toast_no_scanned: 'Aucune page numérisée détectée',
    page_label: 'Page {n}', new_tab: 'Nouvel article',
    settings_title: 'Paramètres', intent_title: 'Démarrer l\'analyse',
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
  },
  de: {
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
  },
  es: {
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
  },
  vi: {
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
  },
};

const SURFACE_COPY = {
  zh: {
    intents: {
      quick: { title: '快速看懂', badge: '速读', desc: '不一定读原文，先抓住问题、结论和意义', body: '把论文压缩成高信号解读：它问什么、回答什么、为什么重要。\n\n适合不一定读原文，先判断这篇论文值不值得深入。\n\n输出：核心问题 · 关键结论 · 3-5 个要点 · 最小阅读路径。' },
      deep: { title: '精读导读', badge: '导读', desc: '准备读原文，先看清论证路线和重点页码', body: '为精读原文做预热：先看清作者如何进入问题、怎样推进论证、哪些页面值得慢读。\n\n适合准备认真读原文、做课堂讨论或组会汇报前使用。\n\n输出：论证路线 · 关键转折 · 慢读页码 · 阅读提示。' },
      question: { title: '带问题读', badge: '问答', desc: '围绕你的问题，直接找答案、证据和边界', body: '从你的具体问题出发，不做泛泛导读：先回答问题，再给论文证据，同时指出论文没有回答或无法证明的部分。\n\n适合已经知道自己想查什么，想让论文服务于某个问题的场景。' },
      deep_notes: { title: '文献笔记', badge: '深度', desc: '完整提取论文逻辑骨架、方法与结果', body: '提取可保存、可复用的论文笔记：\n\n• 核心贡献\n• 问题意识与假设\n• 方法流程\n• 关键结果\n• 局限与未来研究。' },
      critical: { title: '审稿视角', badge: '审稿', desc: '公平评估贡献、证据链、方法限制和硬伤', body: '模拟公正但严格的审稿人：先承认贡献，再评估创新是否成立、证据链是否支撑结论、方法是否有硬伤。\n\n适合评估可信度、筛选综述材料。' },
      research: { title: '选题推进', badge: '科研', desc: '结合你的课题，挖掘空白、迁移方法和选题', body: '把这篇论文和你的研究课题接起来：找到可迁移的方法、未解决的空白、可操作的选题或实验方向。\n\n需要你输入自己的研究课题。' },
    },
    know: { topic: '论文对话', select: '选择对话模式', chat: '问答', chatDesc: '解释论文内容，澄清不懂的地方', check: '检查理解', checkDesc: '用几个问题确认你是否掌握核心论证', start: '开始', done: '完成', close: '关闭', answerPh: '输入你的回答…', questionPh: '输入你的问题…', send: '发送 ›', summary: '小结', clarify: '需要澄清的地方', cont: '继续', noContext: '请先完成一次论文分析，再打开 KnowKnow 对话。', startFirst: '请先完成论文分析', startingErr: 'KnowKnow 启动失败：', thinking: 'KnowKnow 正在整理上下文…', replyErr: 'KnowKnow 回复失败：', startHelp: '先开始一轮对话，再使用 KnowKnow!!!。', helpThinking: 'KnowKnow 正在整理提示…', stuckDefault: '我现在有点卡住，不知道怎么继续。', helpErr: '这一步没接上：', helpFail: '提示生成失败', summaryFail: '总结失败', summaryDefault: '这轮主要是在整理理解。', next: '建议下一步：' },
    lib: { organize: '整理', export: '导出', organizeTitle: '整理旧记录标签', exportTitle: '导出整个书架', organizeConfirm: '整理旧记录会补充分析方式、作者、年份标签，不会改动分析正文。现在开始吗？', organizing: '整理中', organizeFailed: '整理失败', organizeDone: '整理完成：扫描 {scanned} 条，更新 {changed} 条', savedAt: '保存于', addTag: '+ 标签', open: '打开', delete: '删除', tagPh: '输入标签回车确认', deleteConfirm: '确认删除此条记录？PDF 副本也会一并删除。', loadingPaper: '正在加载论文…', analysisLoadFailed: '分析数据加载失败' },
    settings: { maxChars: '最大分析长度：', chars: '字符', maxInfo: '支持约 {pages} 页以内的论文完整分析 · 每次实际消耗约 {low}–{high} token（含输出）', maxWarn: '  ⚠️ 超大文档，消耗较多 token，建议仅在必要时使用', maxHint: '增大后可分析更长文档，但每次调用消耗更多 token', valid: '✓ API Key 有效' },
    doc: { title: '文档体检', high: '文字层较完整', medium: '文字层不完整', low: '疑似扫描版', ocrYes: '本地 OCR 可用，会优先用于扫描页。', ocrNo: '本地 OCR 暂不可用；扫描页会退回到 AI 视觉/OCR。', pages: '页数', coverage: '文字层覆盖', scanned: '疑似扫描页', images: '图片/图表对象' },
    misc: { prev: '上一个', next: '下一个', ocr: '对扫描版页面进行 AI OCR 识别', close: '关闭', fontDec: '缩小字体', fontInc: '放大字体', exportMd: '导出笔记为 Markdown', searchLoading: '搜索中…', loadingPdf: '正在加载 PDF…', uploadFailed: '上传失败', searchOriginal: '搜索原文位置…', unknownPaper: '未知论文', newPaper: '新论文', clickAnalyze: '点击「论文分析」<br>让 AI 解读论文', openAnalyze: '打开论文后点击<br>「论文分析」查看解读', researchPh: '我的研究课题是……（例如：利用大模型进行医疗诊断）' },
  },
  en: {
    intents: {
      quick: { title: 'Quick Read', badge: 'skim', desc: 'Get the question, conclusion, and significance first', body: 'Compress the paper into a high-signal reading: what it asks, what it answers, and why it matters.\n\nBest when you may not read the full paper yet.\n\nOutput: core question · key conclusion · 3-5 takeaways · minimal reading path.' },
      deep: { title: 'Close Reading Guide', badge: 'guide', desc: 'Prepare for close reading with route and key pages', body: 'Prepare attention before close reading: how the author enters the problem, builds the argument, and where the slow-reading pages are.\n\nOutput: argument route · turning points · key pages · reading notes.' },
      question: { title: 'Question-led Reading', badge: 'Q&A', desc: 'Use your question to find answers, evidence, and limits', body: 'Start from your own question: answer it, show the paper evidence, and clarify what the paper does not prove.\n\nBest when you know what you want from the paper.' },
      deep_notes: { title: 'Literature Notes', badge: 'deep', desc: 'Extract argument structure, method, and results', body: 'Create reusable research notes:\n\n• Contributions\n• Problem and assumptions\n• Method flow\n• Key results\n• Limits and future work.' },
      critical: { title: 'Review Lens', badge: 'review', desc: 'Assess contribution, evidence, methods, and weaknesses', body: 'Act like a fair but demanding reviewer: recognize the contribution, then test whether evidence and method support it.\n\nGood for credibility checks and literature screening.' },
      research: { title: 'Research Direction', badge: 'research', desc: 'Find gaps, transferable methods, and topic angles', body: 'Connect this paper to your own research topic: transferable methods, unsolved gaps, and actionable directions.\n\nRequires your research topic.' },
    },
    know: { topic: 'Paper Dialogue', select: 'Choose a mode', chat: 'Q&A', chatDesc: 'Explain the paper and clarify confusing parts', check: 'Check Understanding', checkDesc: 'Use a few questions to verify the core argument', start: 'Start', done: 'Done', close: 'Close', answerPh: 'Type your answer…', questionPh: 'Type your question…', send: 'Send ›', summary: 'Summary', clarify: 'Needs clarification', cont: 'Continue', noContext: 'Analyze a paper first, then open KnowKnow.', startFirst: 'Please analyze a paper first', startingErr: 'KnowKnow failed to start: ', thinking: 'KnowKnow is organizing the context…', replyErr: 'KnowKnow reply failed: ', startHelp: 'Start a dialogue first, then use KnowKnow!!!.', helpThinking: 'KnowKnow is preparing a hint…', stuckDefault: 'I am stuck and not sure how to continue.', helpErr: 'Could not continue here: ', helpFail: 'Hint generation failed', summaryFail: 'Summary failed', summaryDefault: 'This round mainly organized understanding.', next: 'Suggested next step: ' },
    lib: { organize: 'Organize', export: 'Export', organizeTitle: 'Organize old record tags', exportTitle: 'Export the whole library', organizeConfirm: 'Organize old records by adding method, author, and year tags. Analysis text will not be changed. Start now?', organizing: 'Organizing', organizeFailed: 'Organize failed', organizeDone: 'Organized: scanned {scanned}, updated {changed}', savedAt: 'saved at', addTag: '+ tag', open: 'Open', delete: 'Delete', tagPh: 'Type a tag and press Enter', deleteConfirm: 'Delete this record? The PDF copy will also be deleted.', loadingPaper: 'Loading paper…', analysisLoadFailed: 'Failed to load analysis data' },
    settings: { maxChars: 'Max analysis length: ', chars: 'chars', maxInfo: 'Supports about {pages} pages · estimated cost {low}–{high} tokens per run including output', maxWarn: '  ⚠️ Very large document; use only when necessary', maxHint: 'Increasing this allows longer documents but costs more tokens per call', valid: '✓ API Key is valid' },
    doc: { title: 'Document Check', high: 'Text layer mostly complete', medium: 'Text layer incomplete', low: 'Likely scanned', ocrYes: 'Local OCR is available and will be used for scanned pages first.', ocrNo: 'Local OCR is unavailable; scanned pages fall back to AI vision/OCR.', pages: 'Pages', coverage: 'Text coverage', scanned: 'Scanned pages', images: 'Images/charts' },
    misc: { prev: 'Previous', next: 'Next', ocr: 'Run AI OCR on scanned pages', close: 'Close', fontDec: 'Decrease font size', fontInc: 'Increase font size', exportMd: 'Export notes as Markdown', searchLoading: 'Searching…', loadingPdf: 'Loading PDF…', uploadFailed: 'Upload failed', searchOriginal: 'Searching original location…', unknownPaper: 'Unknown paper', newPaper: 'New paper', clickAnalyze: 'Click “Analyze”<br>to let AI read the paper', openAnalyze: 'Open a paper then click<br>“Analyze” to view analysis', researchPh: 'My research topic is…', },
  },
  'zh-TW': {},
  ja: {},
  ko: {},
  fr: {},
  de: {},
  es: {},
  vi: {},
};

SURFACE_COPY['zh-TW'] = {
  ...SURFACE_COPY.zh,
  intents: {
    quick: { title: '快速看懂', badge: '速讀', desc: '不一定讀原文，先抓住問題、結論和意義', body: SURFACE_COPY.zh.intents.quick.body },
    deep: { title: '精讀導讀', badge: '導讀', desc: '準備讀原文，先看清論證路線和重點頁碼', body: SURFACE_COPY.zh.intents.deep.body },
    question: { title: '帶問題讀', badge: '問答', desc: '圍繞你的問題，直接找答案、證據和邊界', body: SURFACE_COPY.zh.intents.question.body },
    deep_notes: { title: '文獻筆記', badge: '深度', desc: '完整提取論文邏輯骨架、方法與結果', body: SURFACE_COPY.zh.intents.deep_notes.body },
    critical: { title: '審稿視角', badge: '審稿', desc: '公平評估貢獻、證據鏈、方法限制和硬傷', body: SURFACE_COPY.zh.intents.critical.body },
    research: { title: '選題推進', badge: '科研', desc: '結合你的課題，挖掘空白、遷移方法和選題', body: SURFACE_COPY.zh.intents.research.body },
  },
  know: { ...SURFACE_COPY.zh.know, topic: '論文對話', select: '選擇對話模式', check: '檢查理解', clarify: '需要澄清的地方', cont: '繼續' },
  lib: { ...SURFACE_COPY.zh.lib, organize: '整理', export: '匯出', open: '開啟', delete: '刪除', addTag: '+ 標籤', savedAt: '儲存於' },
  settings: { ...SURFACE_COPY.zh.settings, maxChars: '最大分析長度：', chars: '字元', valid: '✓ API Key 有效' },
  doc: { ...SURFACE_COPY.zh.doc, title: '文件體檢' },
};

SURFACE_COPY.ko = {
  ...SURFACE_COPY.en,
  intents: {
    quick: { title: '빠르게 이해', badge: '속독', desc: '원문을 다 읽기 전, 문제·결론·의미를 먼저 파악', body: '논문의 핵심을 압축합니다: 무엇을 묻고, 무엇을 답하며, 왜 중요한지.\n\n원문을 전부 읽기 전에 가치와 방향을 판단할 때 적합합니다.\n\n출력: 핵심 질문 · 핵심 결론 · 3-5개 요점 · 최소 읽기 경로.' },
    deep: { title: '정독 가이드', badge: '가이드', desc: '정독 전에 논증 흐름과 중요한 페이지를 파악', body: '정독을 위한 사전 안내입니다. 저자가 문제에 어떻게 들어가고, 논증을 어떻게 전개하며, 어떤 페이지를 천천히 읽어야 하는지 보여줍니다.' },
    question: { title: '질문 중심 읽기', badge: '문답', desc: '내 질문을 기준으로 답, 근거, 한계를 찾기', body: '사용자의 구체적 질문에서 시작합니다. 먼저 논문이 지지하는 답을 제시하고, 근거와 논문이 답하지 못하는 범위를 함께 보여줍니다.' },
    deep_notes: { title: '문헌 노트', badge: '심화', desc: '논문의 논리 구조, 방법, 결과를 정리', body: '저장하고 다시 쓸 수 있는 문헌 노트를 만듭니다:\n\n• 핵심 기여\n• 문제의식과 가설\n• 방법 흐름\n• 주요 결과\n• 한계와 후속 연구.' },
    critical: { title: '심사 관점', badge: '심사', desc: '기여, 근거, 방법, 약점을 균형 있게 평가', body: '공정하지만 엄격한 심사자처럼 봅니다. 기여를 먼저 인정한 뒤, 근거와 방법이 결론을 충분히 뒷받침하는지 점검합니다.' },
    research: { title: '연구 주제 확장', badge: '연구', desc: '공백, 방법 이전, 새 연구 각도 찾기', body: '이 논문을 사용자의 연구 주제와 연결합니다. 이전 가능한 방법, 남은 공백, 실행 가능한 연구 방향을 찾습니다.\n\n사용자의 연구 주제가 필요합니다.' },
  },
  know: { topic: '논문 대화', select: '대화 모드 선택', chat: '문답', chatDesc: '논문 내용을 설명하고 헷갈리는 부분을 정리', check: '이해 점검', checkDesc: '몇 가지 질문으로 핵심 논증 이해를 확인', start: '시작', done: '완료', close: '닫기', answerPh: '답변을 입력하세요…', questionPh: '질문을 입력하세요…', send: '보내기 ›', summary: '요약', clarify: '더 명확히 볼 부분', cont: '계속', noContext: '먼저 논문 분석을 완료한 뒤 KnowKnow를 여세요.', startFirst: '먼저 논문 분석을 완료하세요', startingErr: 'KnowKnow 시작 실패: ', thinking: 'KnowKnow가 맥락을 정리하는 중…', replyErr: 'KnowKnow 응답 실패: ', startHelp: '먼저 대화를 시작한 뒤 KnowKnow!!!를 사용하세요.', helpThinking: 'KnowKnow가 힌트를 준비하는 중…', stuckDefault: '지금 막혀서 어떻게 이어가야 할지 모르겠습니다.', helpErr: '이 단계에서 이어가지 못했습니다: ', helpFail: '힌트 생성 실패', summaryFail: '요약 실패', summaryDefault: '이번 라운드는 이해를 정리하는 데 초점을 두었습니다.', next: '다음 제안: ' },
  lib: { organize: '정리', export: '내보내기', organizeTitle: '기존 기록 태그 정리', exportTitle: '전체 라이브러리 내보내기', organizeConfirm: '기존 기록에 분석 방식, 저자, 연도 태그를 보완합니다. 분석 본문은 바꾸지 않습니다. 시작할까요?', organizing: '정리 중', organizeFailed: '정리 실패', organizeDone: '정리 완료: {scanned}개 확인, {changed}개 업데이트', savedAt: '저장됨', addTag: '+ 태그', open: '열기', delete: '삭제', tagPh: '태그 입력 후 Enter', deleteConfirm: '이 기록을 삭제할까요? PDF 복사본도 함께 삭제됩니다.', loadingPaper: '논문을 불러오는 중…', analysisLoadFailed: '분석 데이터를 불러오지 못했습니다' },
  settings: { maxChars: '최대 분석 길이: ', chars: '자', maxInfo: '약 {pages}쪽까지 전체 분석 가능 · 예상 사용량 {low}–{high} tokens(출력 포함)', maxWarn: '  ⚠️ 매우 큰 문서입니다. 꼭 필요할 때만 사용하세요', maxHint: '값을 높이면 더 긴 문서를 분석할 수 있지만 호출마다 더 많은 token을 사용합니다', valid: '✓ API Key가 유효합니다' },
  doc: { title: '문서 상태 확인', high: '텍스트 레이어 양호', medium: '텍스트 레이어 불완전', low: '스캔본 가능성 높음', ocrYes: '로컬 OCR 사용 가능. 스캔 페이지에 우선 적용됩니다.', ocrNo: '로컬 OCR 사용 불가. 스캔 페이지는 AI 비전/OCR로 처리됩니다.', pages: '쪽수', coverage: '텍스트 레이어', scanned: '스캔 의심 페이지', images: '이미지/도표 객체' },
  misc: { prev: '이전', next: '다음', ocr: '스캔 페이지에 AI OCR 실행', close: '닫기', fontDec: '글자 작게', fontInc: '글자 크게', exportMd: '노트를 Markdown으로 내보내기', searchLoading: '검색 중…', loadingPdf: 'PDF 불러오는 중…', uploadFailed: '업로드 실패', searchOriginal: '원문 위치 검색 중…', unknownPaper: '제목 없음', newPaper: '새 논문', clickAnalyze: '「논문 분석」을 클릭해<br>AI 분석을 시작하세요', openAnalyze: '논문을 열고<br>「논문 분석」을 클릭하세요', researchPh: '내 연구 주제는…' },
};

SURFACE_COPY.ja = { ...SURFACE_COPY.en, know: { ...SURFACE_COPY.en.know, topic: '論文対話', select: '対話モードを選択', chat: 'Q&A', check: '理解チェック', start: '開始', done: '完了', close: '閉じる', send: '送信 ›', summary: '要約', clarify: '確認が必要な点', cont: '続ける' }, lib: { ...SURFACE_COPY.en.lib, organize: '整理', export: 'エクスポート', open: '開く', delete: '削除', addTag: '+ タグ', savedAt: '保存日時' }, settings: { ...SURFACE_COPY.en.settings, maxChars: '最大分析長: ', chars: '文字', valid: '✓ API Key は有効です' }, doc: { ...SURFACE_COPY.en.doc, title: 'ドキュメント確認' } };
SURFACE_COPY.fr = { ...SURFACE_COPY.en, know: { ...SURFACE_COPY.en.know, topic: 'Dialogue papier', select: 'Choisir un mode', chat: 'Questions', check: 'Vérifier la compréhension', start: 'Démarrer', done: 'Terminé', close: 'Fermer', send: 'Envoyer ›', summary: 'Résumé', clarify: 'Point à clarifier', cont: 'Continuer' }, lib: { ...SURFACE_COPY.en.lib, organize: 'Organiser', export: 'Exporter', open: 'Ouvrir', delete: 'Supprimer', addTag: '+ tag', savedAt: 'enregistré le' }, settings: { ...SURFACE_COPY.en.settings, maxChars: 'Longueur max d’analyse : ', chars: 'caractères', valid: '✓ API Key valide' }, doc: { ...SURFACE_COPY.en.doc, title: 'État du document' } };
SURFACE_COPY.de = { ...SURFACE_COPY.en, know: { ...SURFACE_COPY.en.know, topic: 'Paper-Dialog', select: 'Modus wählen', chat: 'Fragen', check: 'Verständnis prüfen', start: 'Start', done: 'Fertig', close: 'Schließen', send: 'Senden ›', summary: 'Zusammenfassung', clarify: 'Zu klären', cont: 'Weiter' }, lib: { ...SURFACE_COPY.en.lib, organize: 'Organisieren', export: 'Exportieren', open: 'Öffnen', delete: 'Löschen', addTag: '+ Tag', savedAt: 'gespeichert am' }, settings: { ...SURFACE_COPY.en.settings, maxChars: 'Max. Analyselänge: ', chars: 'Zeichen', valid: '✓ API Key gültig' }, doc: { ...SURFACE_COPY.en.doc, title: 'Dokumentenprüfung' } };
SURFACE_COPY.es = { ...SURFACE_COPY.en, know: { ...SURFACE_COPY.en.know, topic: 'Diálogo del artículo', select: 'Elegir modo', chat: 'Preguntas', check: 'Comprobar comprensión', start: 'Iniciar', done: 'Listo', close: 'Cerrar', send: 'Enviar ›', summary: 'Resumen', clarify: 'Punto por aclarar', cont: 'Continuar' }, lib: { ...SURFACE_COPY.en.lib, organize: 'Organizar', export: 'Exportar', open: 'Abrir', delete: 'Eliminar', addTag: '+ etiqueta', savedAt: 'guardado el' }, settings: { ...SURFACE_COPY.en.settings, maxChars: 'Longitud máxima: ', chars: 'caracteres', valid: '✓ API Key válida' }, doc: { ...SURFACE_COPY.en.doc, title: 'Revisión del documento' } };
SURFACE_COPY.vi = { ...SURFACE_COPY.en, know: { ...SURFACE_COPY.en.know, topic: 'Đối thoại bài báo', select: 'Chọn chế độ', chat: 'Hỏi đáp', check: 'Kiểm tra hiểu biết', start: 'Bắt đầu', done: 'Xong', close: 'Đóng', send: 'Gửi ›', summary: 'Tóm tắt', clarify: 'Điểm cần làm rõ', cont: 'Tiếp tục' }, lib: { ...SURFACE_COPY.en.lib, organize: 'Sắp xếp', export: 'Xuất', open: 'Mở', delete: 'Xóa', addTag: '+ thẻ', savedAt: 'đã lưu lúc' }, settings: { ...SURFACE_COPY.en.settings, maxChars: 'Độ dài phân tích tối đa: ', chars: 'ký tự', valid: '✓ API Key hợp lệ' }, doc: { ...SURFACE_COPY.en.doc, title: 'Kiểm tra tài liệu' } };

SURFACE_COPY.zh.labels = {
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
  modeQuestion: '带问题读重点', modeDeep: '精读导读重点',
};
SURFACE_COPY.en.labels = {
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
  modeQuestion: 'Question-led Focus', modeDeep: 'Close Reading Focus',
};
SURFACE_COPY.ko.labels = {
  currentMethod: '분석 방식', coreQuestion: '핵심 질문', coreConclusion: '핵심 결론',
  argumentRoute: '논증 흐름', evidenceChain: '근거 사슬', conceptNodes: '개념 노드', readingPath: '읽기 경로',
  noEvidence: '근거 사슬이 없습니다. 다시 분석하거나 인용을 보완하세요.', noConcepts: '개념 노드 없음', noReadingPath: '읽기 경로 없음',
  verified: '✓ 원문에서 확인됨', unverified: '⚠ 원문에서 찾지 못함', notChecked: '○ 미검토',
  evidenceCheck: '근거 확인', found: '개 원문 확인', notFound: '개 찾지 못함', unchecked: '개 미검토',
  scannedWarn: '참고: PDF 텍스트 추출량이 적어 스캔본 검증 신뢰도가 낮을 수 있습니다.',
  keyInsight: '핵심 발견', worthNoting: '주의할 점', keyQuotes: '핵심 원문 인용', readingAdvice: '읽기 제안', vocab: '핵심 용어',
  contributions: '핵심 기여', researchMethod: '연구 방법', keyResults: '주요 결과', limitsFuture: '한계와 후속 연구',
  authorAdmits: '저자가 인정한 한계', blindSpot: '잠재적盲점', innovationEval: '혁신성 평가', methodIssues: '방법 문제',
  hardWeaknesses: '주요 약점', citationAdvice: '인용 제안', transfer: '방법 이전 분석', gaps: '연구 공백',
  experimentIdeas: '연구 아이디어', furtherKeywords: '후속 읽기 키워드', unknownTitle: '제목 없음',
  problem: '문제', method: '방법', finding: '발견', conclusion: '결론',
  modeLiterature: '문헌 노트 초점', modeReview: '심사 관점 초점', modeResearch: '연구 주제 확장 초점',
  modeQuestion: '질문 중심 읽기 초점', modeDeep: '정독 가이드 초점',
};
for (const code of ['zh-TW', 'ja', 'fr', 'de', 'es', 'vi']) {
  SURFACE_COPY[code].labels = code === 'zh-TW' ? SURFACE_COPY.zh.labels : SURFACE_COPY.en.labels;
}

function ui() {
  return SURFACE_COPY[_uiLang] || SURFACE_COPY.en || SURFACE_COPY.zh;
}

function lab(key) {
  return ui().labels?.[key] || SURFACE_COPY.en.labels[key] || SURFACE_COPY.zh.labels[key] || key;
}

function t(key, vars) {
  const tr = TRANSLATIONS[_uiLang] || TRANSLATIONS.zh;
  let s = tr[key] ?? TRANSLATIONS.zh[key] ?? key;
  if (vars) Object.keys(vars).forEach(k => { s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]); });
  return s;
}

function fillVars(s, vars = {}) {
  return String(s || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

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
const tabs = [];
let activeTabId = null;

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

const SETTINGS_KEY = 'pr_settings';
const MODEL_HINTS = {
  claude:  'claude-sonnet-4-6 (recommended)\nclaude-opus-4-7 (strongest)\nclaude-haiku-4-5-20251001 (fastest)',
  openai:  'gpt-4o (recommended)\ngpt-4o-mini (faster)',
  gemini:  'gemini-2.5-flash (recommended)\ngemini-2.5-flash-lite (faster / cheaper)\ngemini-2.5-pro (strongest)',
  deepseek:'deepseek-chat (recommended)\ndeepseek-reasoner (stronger reasoning)',
  groq:    'llama-3.3-70b-versatile (recommended)\nllama-3.1-8b-instant (faster)',
  mistral: 'mistral-small-latest (recommended)\nmistral-medium-latest (stronger)',
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fileInput       = $('fileInput');
const filenameDisplay = $('filenameDisplay');
const analyzeBtn      = $('analyzeBtn');
const pdfToMdBtn      = $('pdfToMdBtn');
const settingsBtn     = $('settingsBtn');
const settingsOverlay = $('settingsOverlay');
const settingsClose   = $('settingsClose');
const saveBtn         = $('saveBtn');
const providerSel     = $('providerSel');
const apiKeyIn        = $('apiKeyIn');
const modelIn         = $('modelIn');
const modelHints      = $('modelHints');
const langSel         = $('langSel');
const maxCharsIn      = $('maxCharsIn');
const maxCharsVal     = $('maxCharsVal');
const maxCharsInfo    = $('maxCharsInfo');
const topbarLangSel   = $('topbarLangSel');
const validateBtn     = $('validateBtn');
const validateResult  = $('validateResult');
const loadingOverlay  = $('loadingOverlay');
const loadingMsg      = $('loadingMsg');
const analyzeStatus   = $('analyzeStatus');
const analyzeStatusText = $('analyzeStatusText');
const sidebarBody     = $('sidebarBody');
const dropZone        = $('dropZone');
const pdfScroll       = $('pdfScroll');
const pdfPages        = $('pdfPages');
const pageBadge       = $('pageBadge');
const curPage         = $('curPage');
const totPage         = $('totPage');
const libraryBtn      = $('libraryBtn');
const libraryOverlay  = $('libraryOverlay');
const libraryClose    = $('libraryClose');
const libOrganizeBtn  = $('libOrganizeBtn');
const libExportBtn    = $('libExportBtn');
const libBody         = $('libBody');
const libSearch       = $('libSearch');
const learnLangBtn    = $('learnLangBtn');
const intentOverlay   = $('intentOverlay');
const intentClose     = $('intentClose');
const intentConfirm   = $('intentConfirm');
const intentOpts      = $('intentOpts');
const intentQuestion  = $('intentQuestion');
const annotPopup      = $('annotPopup');
const annotQuote      = $('annotQuote');
const annotNote       = $('annotNote');
const annotSave       = $('annotSave');
const annotCancel     = $('annotCancel');
const selBar          = $('selBar');
const selCopyBtn      = $('selCopyBtn');
const selAnnotBtn     = $('selAnnotBtn');
const pdfSearchBar    = $('pdfSearchBar');
const pdfSearchInput  = $('pdfSearchInput');
const pdfSearchCount  = $('pdfSearchCount');
const pdfSearchPrev   = $('pdfSearchPrev');
const pdfSearchNext   = $('pdfSearchNext');
const pdfSearchClose  = $('pdfSearchClose');
const pdfSearchOcr    = $('pdfSearchOcr');
const sidebar         = $('sidebar');
const resizeHandle    = $('resizeHandle');
const fontDecBtn      = $('fontDecBtn');
const fontIncBtn      = $('fontIncBtn');
const intentDesc      = $('intentDesc');

let currentFilename    = '';
let guideFontSize      = parseInt(localStorage.getItem('pr_font_size') || '14');
let libAllItems        = [];
let learnLang          = false;
let currentIntent      = 'quick';
let currentQuestion    = '';
let currentLibId       = null;
let currentAnnotations = [];
let pendingAnnotation  = null;   // { text, page } while popup is open
let _selText = '', _selPage = 1; // current selection for selBar

// ── Search state ──────────────────────────────────────────────────────────────
let _searchMatches = [];  // [{pageNum, spanEl}]
let _searchIdx     = -1;
let _searchTerm    = '';
let _searchSeq     = 0;

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
               title="跳转到第 ${a.page} 页">${esc(a.text.slice(0, 60))}${a.text.length > 60 ? '…' : ''}</div>
          <button class="annot-item-del" data-action="del-annot" data-id="${a.id}">✕</button>
        </div>
        <div class="annot-item-note">${esc(a.note)}</div>
        <div class="annot-item-meta">第 ${a.page} 页 · ${esc(a.created_at)}</div>
      </div>`).join('');
  sidebarBody.appendChild(sec);
}

// ── Library ───────────────────────────────────────────────────────────────────
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
  try {
    const r = await fetch('/library/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, filename: currentFilename, analysis }),
    });
    const data = await r.json();
    currentLibId = data.id;
    { const tab = getActiveTab(); if (tab) tab.libId = data.id; }
    toast(t('toast_lib_saved'), 'success');
  } catch {
    // silent — saving is best-effort
  }
}

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
      if (t.page_refs?.length) nl('\n页码：' + t.page_refs.map(r => `第${r.page}页`).join('、'));
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
        ? p.locations.map(l => `第${l.page}页${l.lines ? '·' + l.lines + '行' : ''}`).join('、')
        : (p.pages || []).map(pg => `第${pg}页`).join('、');
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
      nl(`\n*第 ${a.page} 页 · ${a.created_at}*`);
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

function applyFontSize() {
  sidebarBody.style.zoom = (guideFontSize / 14).toFixed(3);
  localStorage.setItem('pr_font_size', guideFontSize);
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

async function saveGuideEdits() {
  syncEditableToStructure();
  if (!currentLibId || !structure) return;
  await fetch(`/library/${currentLibId}/analysis`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analysis: structure }),
  }).catch(() => {});
}

function showIntentDesc(intent) {
  const d = ui().intents?.[intent] || INTENT_DESCRIPTIONS[intent];
  if (!d) { intentDesc.innerHTML = `<div class="tip-empty">${t('intent_tip')}</div>`; return; }
  intentDesc.innerHTML = `<div class="tip-title">${esc(d.title)}</div><div>${esc(d.body).replace(/\n/g, '<br>')}</div>`;
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

// ── PDF rendering ─────────────────────────────────────────────────────────────
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

// ── Navigate to page ──────────────────────────────────────────────────────────
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

// ── AI analysis ───────────────────────────────────────────────────────────────
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
    if (fileId) autoSaveToLibrary(structure);
    battleSetContext(structure);
  } catch (e) {
    toast(t('toast_analyze_failed') + e.message);
  } finally {
    hideAnalyzeStatus();
    analyzeBtn.disabled = !pdfDoc; pdfToMdBtn.disabled = !pdfDoc;
  }
}

// ── Render structure ──────────────────────────────────────────────────────────
function renderStructure(data) {
  // New guide format (has themes)
  if (data.themes) {
    renderGuide(data);
  } else if (data.sections) {
    renderLegacyTree(data);
  }
}

// ── New guide renderer ────────────────────────────────────────────────────────
function evidenceBadge(item) {
  const status = item?.evidence_status || 'not_checked';
  const suffix = item?.evidence_page ? ` · 第 ${item.evidence_page} 页` : '';
  const label = status === 'verified'
    ? `${lab('verified')}${suffix}`
    : status === 'unverified'
      ? lab('unverified')
      : lab('notChecked');
  const note = item?.evidence_note ? ` title="${esc(item.evidence_note)}"` : '';
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

  const readMapHTML = (data.read_this_if || []).slice(0, 3).map(p => {
    const locs = p.locations
      ? p.locations.map(l => `第${l.page}页`).join('、')
      : (p.pages || []).map(pg => `第${pg}页`).join('、');
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

  // ── Cognition Layer (认知层) — visual anchor ──────────────────────
  html += renderCognitionLayer(data);

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
        `<button class="page-ref-btn${evidenceClass(r)}" data-page="${r.page}" data-hint="${esc(r.text_hint || '')}" title="${esc(r.evidence_note || r.text_hint || '')}">第 ${r.page} 页${r.label ? ' · ' + esc(r.label) : ''}</button>`
      ).join('');

      const citesHTML = (theme.citations || []).map(raw => {
        const c = normalizeCitationItem(raw);
        const q = c.quote || '';
        return `<div class="citation-item">
          <span class="citation-text">${esc(q)}</span>
          ${evidenceBadge(c)}
          <div class="citation-actions">
            <button class="cite-btn cite-copy" data-q="${esc(q)}">复制</button>
            <button class="cite-btn cite-find" data-q="${esc(q)}">PDF 定位</button>
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
            <button class="cite-btn cite-copy" data-q="${esc(q)}">复制</button>
            <button class="cite-btn cite-find" data-q="${esc(q)}">PDF 定位</button>
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
          `<span class="read-path-page page-ref-btn" data-page="${loc.page}" data-hint="${esc(loc.hint || '')}">第 ${loc.page} 页${loc.lines ? ' · ' + loc.lines + ' 行' : ''}</span>`
        ).join('');
      } else if (path.pages && path.pages.length) {
        locsHTML = path.pages.map(p =>
          `<span class="read-path-page page-ref-btn" data-page="${p}">第 ${p} 页</span>`
        ).join('');
      }
      html += `<div class="read-path-item">
        <div class="read-path-goal">${esc(path.goal)}</div>
        <div class="read-path-pages">${locsHTML}</div>
      </div>`;
    });
    html += `</div>`;
  }

  // Vocab cards (language learning mode)
  if (data.key_terms && data.key_terms.length) {
    html += `<div class="vocab-section">
      <span class="vocab-section-label">${lab('vocab')}</span>`;
    data.key_terms.forEach(term => {
      html += `<div class="vocab-card">
        <div class="vocab-original">${esc(term.original)}</div>
        <div class="vocab-translation">${esc(term.translation)}</div>
        <div class="vocab-def">${esc(term.definition)}</div>
        ${term.page ? `<button class="page-ref-btn" data-page="${term.page}">第 ${term.page} 页</button>` : ''}
      </div>`;
    });
    html += `</div>`;
  }

  // ── deep_notes extra sections ──
  // Coerce AI output to plain string (guards against unexpected {object} responses)
  const _str = v => {
    if (!v && v !== 0) return '';
    if (typeof v === 'string') return v;
    return v.text || v.content || v.description || v.contribution || v.finding || v.point || JSON.stringify(v);
  };
  if (data.contributions?.length) {
    html += `<div class="mode-section"><span class="section-label">${lab('contributions')}</span>
      <ul class="contributions-list">${data.contributions.map(c => `<li contenteditable="true">${esc(_str(c))}</li>`).join('')}</ul></div>`;
  }
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

// ── Cognition Layer renderer ──────────────────────────────────────────
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

// ── Legacy tree renderer (for old library saves) ──────────────────────────────
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
          <span class="sec-page">第 ${sec.page} 页</span>
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

// ── UI helpers ────────────────────────────────────────────────────────────────
function showLoading(msg) { loadingMsg.textContent = msg; loadingOverlay.style.display = 'flex'; }
function hideLoading()    { loadingOverlay.style.display = 'none'; }
function showAnalyzeStatus(msg) { analyzeStatusText.textContent = msg; analyzeStatus.style.display = 'flex'; }
function hideAnalyzeStatus()    { analyzeStatus.style.display = 'none'; }

let toastTimer;
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

// ◀ — collapse to side handle; chat state preserved, click handle to expand
function collapseBattlePanel() {
  const panel = _bp('battlePanel');
  const handle = document.getElementById('bpHandle');
  if (!panel) return;
  panel.classList.remove('open');
  _bpOpen = false;
  if (handle) handle.style.display = 'flex';
}

// 🦕 handle click — restore the panel
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

_bp('bpInput')?.addEventListener('input', _bpUpdateChars);

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
