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
    title: '快速了解核心观点',
    body: '生成一份有个性的导读，帮你理解这篇论文在讲什么、为什么值得读。\n\n适合不打算精读原文、只需抓住精华的场景。\n\n输出：核心问题 · 主题叙述 · 阅读路径建议。',
  },
  deep: {
    title: '精读前的预热导航',
    body: '侧重于梳理论文的逻辑结构和论证路径，便于精读时知道「重点在哪」「作者为什么这么写」。\n\n输出：论证脉络 · 关键段落导航 · 逻辑结构图。',
  },
  question: {
    title: '带着问题去读',
    body: '所有主题围绕你的具体问题重新组织，最相关的内容优先呈现。\n\n适合带着明确目的读论文，或想快速找到某个具体方面的答案。',
  },
  deep_notes: {
    title: '结构化精读笔记',
    body: '参考资深研究员的阅读方式，提取完整逻辑骨架：\n\n• 3条核心创新贡献\n• 作者的问题意识与假设\n• 方法论逻辑流程（含关键参数）\n• 具体实验结果与对比数据\n• 局限性深度分析\n\n适合需要深度消化的核心文献。',
  },
  critical: {
    title: '批判性分析（审稿视角）',
    body: '模拟顶级期刊审稿人，专门找「刺」：\n\n• 创新是真实突破还是增量？\n• 数据偏差和实验设计漏洞\n• 证据链与因果逻辑\n• 1-2个可能被拒稿的硬伤\n• 引用时的客观评价建议\n\n适合评估论文可信度、筛选文献综述材料。',
  },
  research: {
    title: '延伸研究与选题',
    body: '基于论文内容，为你的研究课题挖掘切入点：\n\n• 核心方法迁移的可行性分析\n• 本文留下的研究空白\n• 3个具体可操作的实验方向\n• 推荐补充阅读的关键词\n\n需要你输入自己的研究课题。适合寻找切入点或准备组会汇报。',
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
let _uiLang = 'zh';

const TRANSLATIONS = {
  zh: {
    title: '论文阅读助手', open_paper: '打开论文', analyze_btn: '分析结构',
    no_file: '未打开文件', sidebar_label: '导读', export_btn: '↓ 导出',
    analyzing: 'AI 正在分析论文…',
    empty_state: '打开论文后点击<br>「分析结构」查看大纲',
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
    settings_title: '设置', intent_title: '开始分析',
    intent_purpose: '你读这篇文章的目的',
    intent_question_ph: '我想了解……',
    intent_tip: '鼠标悬停在左侧选项上查看详细说明',
    intent_confirm: '开始分析',
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
    tab_new_title: '新标签页', learnlang_tooltip: '开启后，AI 会在导读中额外提取 5-8 个核心术语，附上原文词汇、译文和释义。适合在阅读外文文献时同步学习专业词汇。会额外消耗少量 token。',
  },
  en: {
    title: 'Paper Reader', open_paper: 'Open Paper', analyze_btn: 'Analyze',
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
  },
  'zh-TW': {
    title: '論文閱讀助手', open_paper: '開啟論文', analyze_btn: '分析結構',
    no_file: '未開啟文件', sidebar_label: '導讀', export_btn: '↓ 匯出',
    analyzing: 'AI 正在分析論文…',
    empty_state: '開啟論文後點擊<br>「分析結構」查看大綱',
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
    tab_new_title: '新標籤頁', learnlang_tooltip: '開啟後，AI 會在導讀中額外提取 5-8 個核心術語，附上原文詞彙、譯文和釋義。適合閱讀外文文獻時同步學習專業詞彙。會額外消耗少量 token。',
  },
  ja: {
    title: '論文リーダー', open_paper: '論文を開く', analyze_btn: '構造分析',
    no_file: 'ファイル未選択', sidebar_label: '解説', export_btn: '↓ エクスポート',
    analyzing: 'AI が分析中…',
    empty_state: 'PDFを開いて<br>「構造分析」をクリック',
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
  },
  ko: {
    title: '논문 리더', open_paper: '논문 열기', analyze_btn: '구조 분석',
    no_file: '파일 없음', sidebar_label: '가이드', export_btn: '↓ 내보내기',
    analyzing: 'AI가 분석 중…',
    empty_state: 'PDF를 열고<br>「구조 분석」을 클릭하세요',
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
  },
  fr: {
    title: "Lecteur d'articles", open_paper: 'Ouvrir', analyze_btn: 'Analyser',
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
  },
  de: {
    title: 'Paper-Leser', open_paper: 'Öffnen', analyze_btn: 'Analysieren',
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
  },
  es: {
    title: 'Lector de artículos', open_paper: 'Abrir', analyze_btn: 'Analizar',
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
  },
  vi: {
    title: 'Trình đọc bài báo', open_paper: 'Mở bài báo', analyze_btn: 'Phân tích',
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
  },
};

function t(key, vars) {
  const tr = TRANSLATIONS[_uiLang] || TRANSLATIONS.zh;
  let s = tr[key] ?? TRANSLATIONS.zh[key] ?? key;
  if (vars) Object.keys(vars).forEach(k => { s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]); });
  return s;
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
  $('pdfToMdBtn').dataset.label       = 'PDF → MD';

  // Sidebar controls
  const scl = document.querySelector('.sidebar-controls-label');
  if (scl) scl.textContent = t('sidebar_label');
  $('exportBtn').title = t('export_btn').replace('↓ ', '');

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
}

// ── Tabs ──────────────────────────────────────────────────────
const tabs = [];
let activeTabId = null;

function _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

function makeTab(filename) {
  return { id: _uid(), filename: filename || '新论文', fileId: null, libId: null,
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
  } else {
    sidebarBody.innerHTML = `<div class="empty-state"><div class="ei">🔍</div><p>点击「分析结构」<br>让 AI 解析论文大纲</p></div>`;
    renderAnnotations();
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
  sidebarBody.innerHTML = `<div class="empty-state"><div class="ei">📋</div><p>打开论文后点击<br>「分析结构」查看大纲</p></div>`;
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
  claude:  'claude-sonnet-4-6（推荐）\nclaude-opus-4-7（最强）\nclaude-haiku-4-5-20251001（最快）',
  openai:  'gpt-4o（推荐）\ngpt-4o-mini（更快）',
  gemini:  'gemini-2.5-flash（推荐）\ngemini-2.5-flash-lite（更快更便宜）\ngemini-2.5-pro（最强）',
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
  pdfPages.querySelectorAll('.hl-search').forEach(el => {
    el.classList.remove('hl-search', 'current');
  });
}

async function executeSearch(term) {
  clearSearchHighlights();
  _searchMatches = [];
  _searchIdx = -1;
  _searchTerm = term;
  if (!term || !pdfDoc) { pdfSearchCount.textContent = ''; return; }

  const lc = term.toLowerCase();
  const layers = pdfPages.querySelectorAll('.textLayer');
  layers.forEach(layer => {
    layer.querySelectorAll('span').forEach(span => {
      if (span.textContent.toLowerCase().includes(lc)) {
        span.classList.add('hl-search');
        _searchMatches.push({ pageNum: parseInt(layer.dataset.page) || 1, el: span });
      }
    });
  });

  if (_searchMatches.length === 0) {
    pdfSearchCount.textContent = t('search_no_result');
    return;
  }
  _searchIdx = 0;
  navigateSearchMatch();
}

function navigateSearchMatch() {
  if (!_searchMatches.length) return;
  _searchMatches.forEach(m => m.el.classList.remove('current'));
  const match = _searchMatches[_searchIdx];
  match.el.classList.add('current');
  match.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  pdfSearchCount.textContent = t('search_count', { a: _searchIdx + 1, b: _searchMatches.length });
  pdfSearchPrev.disabled = _searchIdx <= 0;
  pdfSearchNext.disabled = _searchIdx >= _searchMatches.length - 1;
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
          <button class="annot-item-del" onclick="deleteAnnotation('${a.id}')">✕</button>
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

function renderLibraryItems(items, query) {
  const filtered = query
    ? items.filter(it =>
        (it.title || '').toLowerCase().includes(query.toLowerCase()) ||
        (it.filename || '').toLowerCase().includes(query.toLowerCase()) ||
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
      <div class="lib-card-meta">${esc(it.authors || '')}${it.year ? ' · ' + esc(it.year) : ''}${date ? ' · 保存于 ' + date : ''}</div>
      <div class="lib-card-footer">
        <div class="lib-tags" id="tags_${it.id}">${tagsHTML}
          <span class="lib-add-tag" onclick="event.stopPropagation();showTagInput('${it.id}')">+ 标签</span>
        </div>
        <div class="lib-card-actions">
          <button class="lib-btn lib-btn-load" onclick="event.stopPropagation();loadFromLibrary('${it.id}','${esc(it.filename)}')">打开</button>
          <button class="lib-btn lib-btn-del"  onclick="event.stopPropagation();deleteLibraryItem('${it.id}')">删除</button>
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
  inp.placeholder = '输入标签回车确认';
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
  showLoading('正在加载论文…');
  try {
    const [analysisResp, annotResp] = await Promise.all([
      fetch(`/library/${libId}/analysis`),
      fetch(`/library/${libId}/annotations`),
    ]);
    if (!analysisResp.ok) throw new Error('分析数据加载失败');
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
    renderTabBar();
    toast(t('toast_lib_loaded'), 'success');
  } catch (e) {
    toast(t('toast_load_failed') + e.message);
  } finally {
    hideLoading();
  }
}

async function deleteLibraryItem(libId) {
  if (!confirm('确认删除此条记录？PDF 副本也会一并删除。')) return;
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
    intentQuestion.placeholder = currentIntent === 'research' ? '我的研究课题是……（例如：利用大模型进行医疗诊断）' : '我想了解……';
    showIntentDesc(currentIntent);
  });
  intentOpts.addEventListener('mouseover', e => {
    const opt = e.target.closest('.intent-opt');
    if (opt) showIntentDesc(opt.dataset.intent);
  });
  intentOpts.addEventListener('mouseleave', () => showIntentDesc(currentIntent));
  intentConfirm.addEventListener('click', () => {
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
  });

  // Library
  libraryBtn.addEventListener('click', openLibrary);
  libraryClose.addEventListener('click', () => libraryOverlay.style.display = 'none');
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
  showLoading('搜索原文位置…');
  // Try progressively shorter prefixes for robustness across PDF text extraction
  const candidates = [
    text.slice(0, 40),
    text.slice(0, 25),
    text.split(/[\s,.;:]/)[0],  // first word/phrase
  ].map(s => s.trim().toLowerCase()).filter(s => s.length > 3);

  try {
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
  if (d.guide_intro) { nl('## 导读'); nl(''); nl(d.guide_intro); nl(''); }

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
  if (d.methodology_flow) { nl('## 方法论'); nl(''); nl(typeof d.methodology_flow === 'string' ? d.methodology_flow : JSON.stringify(d.methodology_flow)); nl(''); }
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
    nl('## 致命弱点'); nl('');
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
    pdfToMdBtn.textContent = 'PDF → MD';
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
  const d = INTENT_DESCRIPTIONS[intent];
  if (!d) { intentDesc.innerHTML = '<div class="tip-empty">鼠标悬停在左侧选项上查看详细说明</div>'; return; }
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
    const r = await fetch('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerSel.value, api_key: key, model: modelIn.value }),
    });
    const data = await r.json();
    if (data.valid) {
      validateResult.textContent = data.warning
        ? '⚠ ' + data.warning
        : '✓ API Key 有效';
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
  const chars = parseInt(maxCharsIn.value);
  maxCharsVal.textContent = chars.toLocaleString() + ' 字符';
  const pages = Math.round(chars / 2500);
  const tokensIn = Math.round(chars / 4);
  let warning = '';
  if (chars > 200000) warning = ' ⚠️ 超大文档，每次调用消耗较多 token，建议仅在必要时使用';
  maxCharsInfo.textContent = `约 ${pages} 页论文 · 输入约 ${tokensIn.toLocaleString()} token${warning}`;
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
  showLoading('正在加载 PDF…');
  try {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/upload', { method: 'POST', body: fd });
    if (!r.ok) throw new Error((await r.json()).detail || '上传失败');
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
        <p>点击「分析结构」<br>让 AI 解析论文大纲</p>
      </div>`;
    await renderPDF(`/pdf/${fileId}`);
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
  if (!wrap) return;
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  curPage.textContent = pageNum;

  // Remove any existing highlights
  document.querySelectorAll('.text-highlight').forEach(el => el.remove());

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
  } else {
    wrap.classList.remove('flash');
    void wrap.offsetWidth;
    wrap.classList.add('flash');
    setTimeout(() => wrap.classList.remove('flash'), 2000);
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
    const hint  = textHint.toLowerCase().trim();

    // Strategy 1: sliding-window phrase match
    let matchIdx = -1;
    for (let i = 0; i < spans.length; i++) {
      const win = spans.slice(i, i + 10).map(s => s.textContent).join(' ');
      if (win.toLowerCase().includes(hint)) { matchIdx = i; break; }
    }

    // Strategy 2: any significant word from hint
    if (matchIdx === -1) {
      const words = hint.split(/\s+/).filter(w => w.length > 4);
      outer: for (const word of words) {
        for (let i = 0; i < spans.length; i++) {
          if (spans[i].textContent.toLowerCase().includes(word)) { matchIdx = i; break outer; }
        }
      }
    }

    if (matchIdx === -1) return false;

    const matchSpan = spans[matchIdx];
    const matchTop  = parseFloat(matchSpan.style.top);
    const fontSize  = parseFloat(matchSpan.style.fontSize) || 12;
    const band      = fontSize * 3;

    const toHL = spans.filter(s => Math.abs(parseFloat(s.style.top) - matchTop) <= band);
    toHL.forEach(s => s.classList.add('hl'));
    setTimeout(() => toHL.forEach(s => s.classList.remove('hl')), 3500);

    matchSpan.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  } catch { return false; }
}

// ── AI analysis ───────────────────────────────────────────────────────────────
async function handleAnalyze() {
  const s = loadSettings();
  if (!s.apiKey) {
    toast(t('toast_need_api_key2'));
    settingsOverlay.style.display = 'flex';
    return;
  }
  if (!fileId && !currentLibId) { toast(t('toast_need_pdf')); return; }

  // Reset intent dialog state
  intentOpts.querySelectorAll('.intent-opt').forEach(o => o.classList.remove('selected'));
  intentOpts.querySelector('[data-intent="quick"]').classList.add('selected');
  currentIntent = 'quick';
  intentQuestion.value = '';
  intentQuestion.style.display = 'none';
  intentQuestion.placeholder = t('intent_question_ph');
  intentDesc.innerHTML = `<div class="tip-empty">${t('intent_tip')}</div>`;
  intentOverlay.style.display = 'flex';
}

async function doAnalyze() {
  const s = loadSettings();
  const provider = s.provider || 'claude';
  const DEFAULT_MODELS = { claude: 'claude-sonnet-4-6', openai: 'gpt-4o', gemini: 'gemini-2.5-flash' };
  const modelName = s.model || DEFAULT_MODELS[provider] || provider;
  const analyzeTime = new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const INTENT_LABELS = { quick: '快速了解', deep: '精读导航', question: '定向问答', deep_notes: '结构化笔记', critical: '批判性分析', research: '延伸研究' };

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
      time:     analyzeTime,
      tokens:   usage.total || 0,
      input:    usage.input || 0,
      output:   usage.output || 0,
    };
    { const tab = getActiveTab(); if (tab) tab.structure = structure; }
    renderStructure(structure);
    if (fileId) autoSaveToLibrary(structure);
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
function renderGuide(data) {
  let html = '';

  // Paper header
  html += `<div class="guide-paper-info">
    <div class="guide-paper-title">${esc(data.title || '未知标题')}</div>
    <div class="guide-paper-meta">${esc(data.authors || '')}${data.year ? ' · ' + esc(data.year) : ''}</div>
  </div>`;

  // Analysis metadata footnote
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

  // Core question
  if (data.core_question) {
    html += `<div class="core-question" contenteditable="true" data-path="core_question">${esc(data.core_question)}</div>`;
  }

  // Key insight
  if (data.key_insight) {
    html += `<div class="key-insight">
      <span class="key-insight-label">核心发现</span>
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
        `<button class="page-ref-btn" data-page="${r.page}" data-hint="${esc(r.text_hint || '')}">第 ${r.page} 页${r.label ? ' · ' + esc(r.label) : ''}</button>`
      ).join('');

      const citesHTML = (theme.citations || []).map(q =>
        `<div class="citation-item">
          <span class="citation-text">${esc(q)}</span>
          <div class="citation-actions">
            <button class="cite-btn cite-copy" data-q="${esc(q)}">复制</button>
            <button class="cite-btn cite-find" data-q="${esc(q)}">PDF 定位</button>
          </div>
        </div>`
      ).join('');

      html += `<div class="theme-item" data-id="${theme.id}">
        <div class="theme-head" onclick="toggleTheme('${theme.id}')">
          <div class="theme-toggle" id="ttog_${theme.id}">▶</div>
          <div class="theme-text">
            <span class="theme-heading" contenteditable="true" data-path="theme.${theme.id}.heading" onclick="event.stopPropagation()">${esc(theme.heading)}</span>
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
      <span class="skeptics-label">值得留意</span>
      <div contenteditable="true" data-path="skeptics_note">${esc(data.skeptics_note)}</div>
    </div>`;
  }

  // Key citations (global)
  if (data.key_citations?.length) {
    html += `<div class="mode-section" style="margin:8px 14px 0"><span class="section-label">关键原文引用</span>
      <div class="citations-list">${data.key_citations.map(c => {
        const q = typeof c === 'string' ? c : (c.quote || '');
        const lbl = typeof c === 'string' ? '' : (c.label || '');
        return `<div class="citation-item">
          ${lbl ? `<span class="citation-label">${esc(lbl)}</span>` : ''}
          <span class="citation-text">${esc(q)}</span>
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
      <div class="read-paths-label">阅读建议</div>`;
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
      <span class="vocab-section-label">核心词汇</span>`;
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
    html += `<div class="mode-section"><span class="section-label">核心贡献</span>
      <ul class="contributions-list">${data.contributions.map(c => `<li contenteditable="true">${esc(_str(c))}</li>`).join('')}</ul></div>`;
  }
  if (data.methodology_flow) {
    html += `<div class="mode-section"><span class="section-label">方法论</span>
      <div class="methodology-text" contenteditable="true" data-path="methodology_flow">${esc(_str(data.methodology_flow))}</div></div>`;
  }
  if (data.key_results?.length) {
    html += `<div class="mode-section"><span class="section-label">关键结果</span>` +
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
    html += `<div class="mode-section"><span class="section-label">局限与未来方向</span>
      ${lf.author_admits ? `<div class="issue-item"><div class="issue-title">作者承认</div><div class="issue-detail" contenteditable="true" data-path="lf_author">${esc(lf.author_admits)}</div></div>` : ''}
      ${lf.expert_critique ? `<div class="issue-item"><div class="issue-title">潜在盲点</div><div class="issue-detail" contenteditable="true" data-path="lf_expert">${esc(lf.expert_critique)}</div></div>` : ''}
    </div>`;
  }

  // ── critical extra sections ──
  if (data.innovation_verdict) {
    const vc = data.innovation_verdict.includes('真正') ? 'verdict-good' : data.innovation_verdict.includes('增量') ? 'verdict-mid' : 'verdict-bad';
    html += `<div class="mode-section"><span class="section-label">创新性评估</span>
      <div class="innovation-verdict ${vc}">${esc(data.innovation_verdict)}</div>
      ${data.innovation_analysis ? `<div class="issue-detail" contenteditable="true" data-path="innovation_analysis">${esc(data.innovation_analysis)}</div>` : ''}
    </div>`;
  }
  if (data.methodology_issues?.length) {
    html += `<div class="mode-section"><span class="section-label">方法论问题</span>` +
      data.methodology_issues.map(i => `<div class="issue-item">
        <div class="issue-title">${esc(i.issue)}</div>
        <div class="issue-detail">${esc(i.detail)}</div>
      </div>`).join('') + `</div>`;
  }
  if (data.fatal_weaknesses?.length) {
    html += `<div class="mode-section"><span class="section-label">致命弱点</span>` +
      data.fatal_weaknesses.map(w => `<div class="fatal-item">
        <div class="fatal-weakness">${esc(w.weakness)}</div>
        ${w.impact ? `<div class="fatal-impact">${esc(w.impact)}</div>` : ''}
      </div>`).join('') + `</div>`;
  }
  if (data.citation_note) {
    html += `<div class="mode-section"><span class="section-label">引用建议</span>
      <div class="citation-box" contenteditable="true" data-path="citation_note">${esc(data.citation_note)}</div></div>`;
  }

  // ── research extra sections ──
  if (data.transfer_analysis) {
    html += `<div class="mode-section"><span class="section-label">方法迁移分析</span>
      <div class="methodology-text" contenteditable="true" data-path="transfer_analysis">${esc(data.transfer_analysis)}</div></div>`;
  }
  if (data.research_gaps?.length) {
    html += `<div class="mode-section"><span class="section-label">研究空白</span>` +
      data.research_gaps.map(g => `<div class="gap-item">${esc(g)}</div>`).join('') + `</div>`;
  }
  if (data.experiment_ideas?.length) {
    html += `<div class="mode-section"><span class="section-label">实验方向</span>` +
      data.experiment_ideas.map(idea => `<div class="idea-item">
        <div class="idea-name">💡 ${esc(idea.name)}</div>
        <div class="idea-hypothesis">${esc(idea.hypothesis)}</div>
        <div class="idea-challenges">⚠ ${esc(idea.challenges)}</div>
      </div>`).join('') + `</div>`;
  }
  if (data.ref_keywords?.length) {
    html += `<div class="mode-section"><span class="section-label">推荐延伸阅读</span>
      <div class="ref-keywords">${data.ref_keywords.map(k => `<span class="ref-tag">${esc(k)}</span>`).join('')}</div></div>`;
  }

  sidebarBody.innerHTML = html;
  renderAnnotations();
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
      <div class="sec-head" onclick="selectSection('${sec.id}',${sec.page})">
        <div class="toggle-icon ${hasSubs ? 'open' : 'leaf'}" id="tog_${sec.id}"
             onclick="event.stopPropagation();toggleChildren('${sec.id}')">${hasSubs ? '▶' : ''}</div>
        <div class="sec-text">
          <span class="sec-title">${esc(sec.title)}</span>
          <span class="sec-page">第 ${sec.page} 页</span>
        </div>
      </div>
      ${summaryHTML}${childrenHTML}
    </div>`;
  }

  html += data.sections.map(buildSection).join('');
  sidebarBody.innerHTML = html;
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

// Expose onclick handlers to global scope
window.selectSection     = selectSection;
window.toggleChildren    = toggleChildren;
window.toggleTheme       = toggleTheme;
window.goToPage          = goToPage;
window.loadFromLibrary   = loadFromLibrary;
window.deleteLibraryItem = deleteLibraryItem;
window.showTagInput      = showTagInput;
window.deleteAnnotation  = deleteAnnotation;

init();
