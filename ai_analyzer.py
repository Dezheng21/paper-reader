import asyncio
import json
import logging
import re
from typing import List, Dict

logger = logging.getLogger(__name__)

DEPTH_INSTRUCTIONS = {
    "brief":    "Include 3-5 themes. Each theme narrative: 2-3 sentences. Be punchy and direct.",
    "detailed": "Include 5-8 themes. Each theme narrative: 3-5 sentences with concrete examples from the paper.",
    "deep":     "Include 7-10 themes. Each theme narrative: 5-7 sentences with deep analysis — unpack the logic, note what's clever or questionable, draw out implications.",
}

INTENT_INSTRUCTIONS = {
    "quick": (
        "MODE: QUICK UNDERSTANDING. The reader may NOT read the original paper. "
        "Do not behave like a detailed reading guide. Compress aggressively. "
        "Prioritize only: the paper's central question, the author's answer, why it matters, "
        "3-5 concrete takeaways, and one common misunderstanding to avoid. "
        "Keep themes few and high-signal; avoid methodological details unless they are essential to the main claim. "
        "read_this_if should be minimal and practical: only point to the 1-3 places worth opening if the reader has limited time."
    ),
    "deep": (
        "MODE: CLOSE-READING NAVIGATION. The reader WILL read the original paper after this guide. "
        "Your job is to prepare their attention before close reading. "
        "Emphasize the paper's argument route: what problem it enters, how the author builds the case, "
        "where the key turns in the reasoning happen, and which pages/sections deserve slow reading. "
        "Make read_this_if detailed and specific: tell the reader what to look for at each location and why it matters."
    ),
    "deep_notes": (
        "Generate comprehensive structured reading notes like a senior researcher. "
        "You MUST populate these extra JSON fields using EXACTLY these formats (all leaf values must be plain strings, never nested objects):\n"
        "  \"contributions\": [\"plain string innovation 1\", \"plain string innovation 2\", \"plain string innovation 3\"],\n"
        "  \"methodology_flow\": \"single plain-string paragraph describing the logical flow, key parameters, and datasets\",\n"
        "  \"key_results\": [{\"finding\": \"what was found\", \"data\": \"specific number/percentage or empty string\", \"comparison\": \"vs what baseline or empty string\"}],\n"
        "  \"limitations_future\": {\"author_admits\": \"limitations the author acknowledges\", \"expert_critique\": \"blind spots an expert would flag\"}"
    ),
    "critical": (
        "Act as a fair but demanding reviewer for a top journal. Do NOT merely attack. "
        "First recognize the paper's strongest contribution, then evaluate whether the evidence and method actually support it. "
        "Be rigorous, balanced, and specific; avoid performative harshness. "
        "You MUST populate these extra fields: "
        "innovation_verdict (EXACTLY one of: '真正突破' | '增量创新' | '新瓶装旧酒'), "
        "innovation_analysis (detailed assessment vs SOTA), "
        "methodology_issues (array of {issue, detail} for sample bias / experimental design / generalization), "
        "logic_problems (evidence chain completeness and any correlation-causation confusion), "
        "fatal_weaknesses (array of {weakness, impact}, 1-2 items max, the deal-breakers), "
        "citation_note (one objective sentence for citing this paper, covering both merits and limits)."
    ),
    "research": (
        "Act as a research mentor helping the reader find new research directions. "
        "The reader's own research topic is provided in the question field — use it throughout. "
        "If the reader's research topic is broad, turn it into 2-3 sharper possible angles before proposing experiments. "
        "You MUST populate these extra fields: "
        "transfer_analysis (feasibility of applying this paper's core method to the reader's topic, with specific adaptations needed), "
        "research_gaps (array of 2-3 specific unsolved problems this paper leaves open, especially relevant to the reader's topic), "
        "experiment_ideas (array of 3 objects: {name, hypothesis (format: 'if method X applied to Y, expect Z improvement'), challenges}), "
        "ref_keywords (array of 3-5 keywords for further reading)."
    ),
}


def _build_text(pages: List[Dict], max_chars: int = 32000) -> str:
    parts = []
    total = 0
    for p in pages:
        chunk = f"[PAGE {p['page']}]\n{p['text']}"
        if total + len(chunk) > max_chars:
            remaining = len(pages) - p["page"] + 1
            parts.append(f"\n[... {remaining} pages truncated due to length ...]")
            break
        parts.append(chunk)
        total += len(chunk)
    return "\n\n".join(parts)


def _build_prompt_core(depth: str, lang: str, intent: str,
                       learn_lang: bool, intent_question: str) -> tuple:
    """Returns (instruction, intent_instr, key_terms_instr, key_terms_schema)."""
    instruction = DEPTH_INSTRUCTIONS.get(depth, DEPTH_INSTRUCTIONS["brief"])

    if intent == "question" and intent_question:
        safe_q = intent_question[:500].replace("<", "&lt;").replace(">", "&gt;")
        intent_instr = (
            f"MODE: QUESTION-LED READING. The reader's specific question is: <user_question>{safe_q}</user_question>. "
            "Do NOT merely reorganize a generic guide. Start from this question. "
            "The output should first give the most direct answer the paper supports, then show the evidence, "
            "then clearly state what the paper does NOT answer or cannot prove. "
            "Themes must be selected and ordered by relevance to the question. "
            "Every theme should explain how it helps answer, complicate, or limit the reader's question."
        )
    elif intent == "research" and intent_question:
        safe_q = intent_question[:500].replace("<", "&lt;").replace(">", "&gt;")
        base = INTENT_INSTRUCTIONS["research"]
        intent_instr = base + f" The reader's research topic is: <user_question>{safe_q}</user_question>."
    else:
        intent_instr = INTENT_INSTRUCTIONS.get(intent, INTENT_INSTRUCTIONS["quick"])

    if learn_lang:
        key_terms_instr = f"""
LANGUAGE LEARNING MODE IS ON: You MUST populate the "key_terms" array with 5-8 important technical terms from this paper.
For each term include:
  "original": exact term as it appears in the paper's original language
  "translation": translation in {lang}
  "definition": one plain sentence in {lang} explaining what it means in this paper's context
  "page": page number where it first or most prominently appears
"""
        key_terms_schema = """,
  "key_terms": [
    {{"original": "term in paper language", "translation": "译文", "definition": "释义", "page": 1}}
  ]"""
    else:
        key_terms_instr = ""
        key_terms_schema = ',\n  "key_terms": []'

    return instruction, intent_instr, key_terms_instr, key_terms_schema


def _build_prompt_pdf(depth: str, lang: str = "Chinese",
                      intent: str = "quick", learn_lang: bool = False,
                      intent_question: str = "") -> str:
    """Prompt for PDF-file mode (no inline text — the PDF is attached separately)."""
    instruction, intent_instr, key_terms_instr, key_terms_schema = \
        _build_prompt_core(depth, lang, intent, learn_lang, intent_question)

    return f"""You are writing a "guided reading" introduction for the attached academic paper — like the kind a knowledgeable friend or scholar writes when they want to help someone understand why a paper is worth reading and what to make of it.

Your job is NOT to summarize each section in order. Your job is to help the reader understand: what this paper is really arguing, why it matters, what's surprising or counterintuitive about it, and where to focus their limited attention.

Write with intellectual personality. If an argument is clever, say so. If a finding is counterintuitive, highlight it. If the paper makes a bold claim, engage with it. Avoid bureaucratic language.

CRITICAL: Write ALL text fields in {lang}. Translate everything into {lang} regardless of the paper's original language.

READER INTENT: {intent_instr}

{instruction}

{key_terms_instr}
Use the actual page numbers from the attached PDF for all page_refs.

PAGE REFS: In every page_ref, include "text_hint" — a verbatim 5-10 word phrase copied exactly from the paper near that reference, in the paper's ORIGINAL language (used for text search). Example: {{"label": "核心论证", "page": 3, "text_hint": "dual-lineage nurturing is not a biological"}}

Return ONLY a valid JSON object (no markdown fences) with this exact structure:
{{
  "title": "paper title in {lang}",
  "authors": "author names",
  "year": "year or empty string",
  "one_line_thesis": "THE single most important claim of the paper, in ONE punchy sentence (target: under 30 chars/words). What the reader should remember if they only remember one thing. Sharp, declarative, no hedging. Example: '居住地安全感比国族自豪感更能预测移民态度'",
  "three_pillars": [
    {{"label": "为什么重要", "text": "Why this paper matters — the gap or tension it addresses. 1 short sentence."}},
    {{"label": "怎么知道的", "text": "The core method or evidence path. 1 short sentence."}},
    {{"label": "所以呢", "text": "The implication, application, or boundary. 1 short sentence."}}
  ],
  "reading_shortcut": "One concrete reading hint, e.g. '只读 1 分钟 → 看 P3 第二段「核心发现」'. Be specific about page and what to find there.",
  "core_question": "The single central question this paper addresses. One sentence.",
  "key_insight": "The most important or surprising finding. 1-2 sentences with personality.",
  "guide_intro": "Opening paragraph (3-5 sentences). Avoid starting with 'This paper...'",
  "visual_summary": {{
    "logic_steps": [
      {{"label": "问题", "text": "What problem/question the paper starts from"}},
      {{"label": "方法", "text": "What material/data/method the author uses"}},
      {{"label": "发现", "text": "The central finding or conceptual move"}},
      {{"label": "结论", "text": "What conclusion or implication follows"}}
    ],
    "evidence_chain": [
      {{"claim": "one key claim", "support": "quote/data/method/figure", "status": "verified|unverified|not_checked", "page": 1}}
    ],
    "concept_map": [
      "concept A → relation → concept B"
    ]
  }},
  "themes": [
    {{
      "id": "t1",
      "heading": "Thematic heading as an IDEA or QUESTION, not a section title.",
      "narrative": "Theme explanation with personality and concrete examples.",
      "highlight": "The single most memorable point. One sharp sentence.",
      "page_refs": [{{"label": "核心论证", "page": 1, "text_hint": "exact phrase from paper"}}],
      "citations": ["Verbatim sentence or clause copied EXACTLY from the paper in its ORIGINAL language that directly supports this theme. DO NOT translate. Copy word-for-word."]
    }}
  ],
  "skeptics_note": "One honest limitation or caveat. 1-2 sentences.",
  "read_this_if": [
    {{"goal": "你只有10分钟", "locations": [{{"page": 1, "lines": "1~8", "hint": "verbatim phrase"}}, {{"page": 2, "lines": "5~12", "hint": "verbatim phrase"}}]}},
    {{"goal": "你想理解论证过程", "locations": [{{"page": 3, "lines": "3~15", "hint": "verbatim phrase"}}, {{"page": 4, "lines": "1~10", "hint": "verbatim phrase"}}]}}
  ],
  "key_citations": [
    {{"label": "brief note in {lang} explaining why this quote is significant", "quote": "verbatim sentence from paper in its ORIGINAL language — do not translate"}}
  ]{key_terms_schema}
}}

Rules:
- one_line_thesis: this is THE cognitive anchor. Make it punchy and concrete. Never start with vague phrases like "This paper explores..." — make the actual claim. If the paper's contribution can't fit in one sharp sentence, the paper has multiple claims and you should pick the most important one.
- three_pillars: must be tightly coupled — pillar 1 sets up the gap, pillar 2 explains how the paper closes it, pillar 3 says what changes because of that. Do not just restate the abstract.
- reading_shortcut: must reference a SPECIFIC page and paragraph/section where the core finding is stated. Useless if vague.
- theme headings must be idea-based, never bare section names
- every page_ref must have text_hint in the paper's original language
- read_this_if: 2-4 entries, practical and specific. For each location: "page" is the page number, "lines" is an approximate line range on that page (e.g. "3~12"), "hint" is a verbatim 5-8 word phrase from the paper text at that location (original language)
- citations per theme: 1-2 verbatim sentences/clauses copied EXACTLY from the paper in its ORIGINAL language — never translate, never paraphrase
- key_citations: 3-5 of the most important or memorable sentences from the entire paper, verbatim in original language, each with a short label in {lang} explaining its significance
- visual_summary is for the UI dashboard: keep it short, visual, and structurally useful; concept_map items should describe relationships, not just isolated keywords
- if the intent instructions say to populate extra fields, you MUST include them in the JSON
- return valid JSON only"""


def _build_prompt(pages: List[Dict], depth: str, lang: str = "Chinese",
                  intent: str = "quick", learn_lang: bool = False,
                  intent_question: str = "", max_chars: int = 100000) -> str:
    text = _build_text(pages, max_chars=max_chars)
    instruction, intent_instr, key_terms_instr, key_terms_schema = \
        _build_prompt_core(depth, lang, intent, learn_lang, intent_question)

    return f"""You are writing a "guided reading" introduction for an academic paper — like the kind a knowledgeable friend or scholar writes when they want to help someone understand why a paper is worth reading and what to make of it.

Your job is NOT to summarize each section in order. Your job is to help the reader understand: what this paper is really arguing, why it matters, what's surprising or counterintuitive about it, and where to focus their limited attention.

Write with intellectual personality. If an argument is clever, say so. If a finding is counterintuitive, highlight it. If the paper makes a bold claim, engage with it. Avoid bureaucratic language.

CRITICAL: Write ALL text fields in {lang}. Translate everything into {lang} regardless of the paper's original language.

READER INTENT: {intent_instr}

{instruction}

{key_terms_instr}
The text contains [PAGE N] markers. Use them to assign page numbers in page_refs.

PAGE REFS: In every page_ref, include "text_hint" — a verbatim 5-10 word phrase copied exactly from the paper text near that reference. Use the paper's ORIGINAL language for text_hint (used for text search). Example: {{"label": "核心论证", "page": 3, "text_hint": "dual-lineage nurturing is not a biological"}}

Return ONLY a valid JSON object (no markdown fences) with this exact structure:
{{
  "title": "paper title in {lang}",
  "authors": "author names",
  "year": "year or empty string",
  "one_line_thesis": "THE single most important claim of the paper, in ONE punchy sentence (target: under 30 chars/words). What the reader should remember if they only remember one thing. Sharp, declarative, no hedging. Example: '居住地安全感比国族自豪感更能预测移民态度'",
  "three_pillars": [
    {{"label": "为什么重要", "text": "Why this paper matters — the gap or tension it addresses. 1 short sentence."}},
    {{"label": "怎么知道的", "text": "The core method or evidence path. 1 short sentence."}},
    {{"label": "所以呢", "text": "The implication, application, or boundary. 1 short sentence."}}
  ],
  "reading_shortcut": "One concrete reading hint, e.g. '只读 1 分钟 → 看 P3 第二段「核心发现」'. Be specific about page and what to find there.",
  "core_question": "The single central question this paper addresses. One sentence.",
  "key_insight": "The most important or surprising finding. 1-2 sentences with personality.",
  "guide_intro": "Opening paragraph (3-5 sentences). Avoid starting with 'This paper...'",
  "visual_summary": {{
    "logic_steps": [
      {{"label": "问题", "text": "What problem/question the paper starts from"}},
      {{"label": "方法", "text": "What material/data/method the author uses"}},
      {{"label": "发现", "text": "The central finding or conceptual move"}},
      {{"label": "结论", "text": "What conclusion or implication follows"}}
    ],
    "evidence_chain": [
      {{"claim": "one key claim", "support": "quote/data/method/figure", "status": "verified|unverified|not_checked", "page": 1}}
    ],
    "concept_map": [
      "concept A → relation → concept B"
    ]
  }},
  "themes": [
    {{
      "id": "t1",
      "heading": "Thematic heading as an IDEA or QUESTION, not a section title.",
      "narrative": "Theme explanation with personality and concrete examples.",
      "highlight": "The single most memorable point. One sharp sentence.",
      "page_refs": [{{"label": "核心论证", "page": 1, "text_hint": "exact phrase from paper"}}],
      "citations": ["Verbatim sentence or clause copied EXACTLY from the paper in its ORIGINAL language that directly supports this theme. DO NOT translate. Copy word-for-word."]
    }}
  ],
  "skeptics_note": "One honest limitation or caveat. 1-2 sentences.",
  "read_this_if": [
    {{"goal": "你只有10分钟", "locations": [{{"page": 1, "lines": "1~8", "hint": "verbatim phrase"}}, {{"page": 2, "lines": "5~12", "hint": "verbatim phrase"}}]}},
    {{"goal": "你想理解论证过程", "locations": [{{"page": 3, "lines": "3~15", "hint": "verbatim phrase"}}, {{"page": 4, "lines": "1~10", "hint": "verbatim phrase"}}]}}
  ],
  "key_citations": [
    {{"label": "brief note in {lang} explaining why this quote is significant", "quote": "verbatim sentence from paper in its ORIGINAL language — do not translate"}}
  ]{key_terms_schema}
}}

Rules:
- one_line_thesis: this is THE cognitive anchor. Make it punchy and concrete. Never start with vague phrases like "This paper explores..." — make the actual claim. If the paper's contribution can't fit in one sharp sentence, the paper has multiple claims and you should pick the most important one.
- three_pillars: must be tightly coupled — pillar 1 sets up the gap, pillar 2 explains how the paper closes it, pillar 3 says what changes because of that. Do not just restate the abstract.
- reading_shortcut: must reference a SPECIFIC page and paragraph/section where the core finding is stated. Useless if vague.
- theme headings must be idea-based, never bare section names
- every page_ref must have text_hint in the paper's original language
- read_this_if: 2-4 entries, practical and specific. For each location: "page" is the page number, "lines" is an approximate line range on that page (e.g. "3~12"), "hint" is a verbatim 5-8 word phrase from the paper text at that location (original language)
- citations per theme: 1-2 verbatim sentences/clauses copied EXACTLY from the paper in its ORIGINAL language — never translate, never paraphrase
- key_citations: 3-5 of the most important or memorable sentences from the entire paper, verbatim in original language, each with a short label in {lang} explaining its significance
- visual_summary is for the UI dashboard: keep it short, visual, and structurally useful; concept_map items should describe relationships, not just isolated keywords
- if the intent instructions say to populate extra fields, you MUST include them in the JSON
- return valid JSON only

Paper text:
{text}"""


async def validate_key(provider: str, api_key: str, model: str = "") -> None:
    """Make a minimal API call to confirm the key works. Raises on failure."""
    if provider == "claude":
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        client.messages.create(
            model=model or "claude-haiku-4-5-20251001",
            max_tokens=5,
            messages=[{"role": "user", "content": "Hi"}],
        )
    elif provider == "openai":
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=5,
        )
    elif provider == "gemini":
        from google import genai
        client = genai.Client(api_key=api_key)
        client.models.generate_content(
            model=model or "gemini-2.5-flash",
            contents="Hi",
        )


async def analyze_paper(
    pages: List[Dict], provider: str, api_key: str, depth: str, model: str = "",
    lang: str = "Chinese", intent: str = "quick", learn_lang: bool = False,
    intent_question: str = "", pdf_path: str = "", max_chars: int = 100000
) -> dict:
    # Scale output tokens with input length; cap at 16 384 for broad API compatibility
    max_out_tokens = max(8192, min(16384, max_chars // 8))

    if pdf_path:
        prompt = _build_prompt_pdf(depth, lang, intent, learn_lang, intent_question)
        logger.info("Using PDF-file mode (scanned/image PDF)")
    else:
        prompt = _build_prompt(pages, depth, lang, intent, learn_lang, intent_question,
                               max_chars=max_chars)

    COMPAT_PROVIDERS = {
        "deepseek": ("https://api.deepseek.com",      "deepseek-chat"),
        "groq":     ("https://api.groq.com/openai/v1", "llama-3.3-70b-versatile"),
        "mistral":  ("https://api.mistral.ai/v1",      "mistral-small-latest"),
    }

    last_err = None
    for attempt in range(3):
        try:
            if pdf_path:
                # OpenAI-compat providers don't have PDF vision — fall back to text mode
                if provider in COMPAT_PROVIDERS:
                    text_prompt = _build_prompt(pages, depth, lang, intent, learn_lang,
                                                intent_question, max_chars=max_chars)
                    base_url, default_model = COMPAT_PROVIDERS[provider]
                    result = await _openai_compat(text_prompt, api_key, model or default_model,
                                                  max_out_tokens, base_url)
                    return _attach_evidence_checks(result, pages)
                if provider == "claude":
                    result = await _claude_pdf(prompt, pdf_path, api_key, model, max_out_tokens)
                    return _attach_evidence_checks(result, pages)
                if provider == "openai":
                    result = await _openai_pdf(prompt, pdf_path, api_key, model, max_out_tokens)
                    return _attach_evidence_checks(result, pages)
                if provider == "gemini":
                    result = await _gemini_pdf(prompt, pdf_path, api_key, model, max_out_tokens)
                    return _attach_evidence_checks(result, pages)
            else:
                if provider in COMPAT_PROVIDERS:
                    base_url, default_model = COMPAT_PROVIDERS[provider]
                    result = await _openai_compat(prompt, api_key, model or default_model,
                                                  max_out_tokens, base_url)
                    return _attach_evidence_checks(result, pages)
                if provider == "claude":
                    result = await _claude(prompt, api_key, model, max_out_tokens)
                    return _attach_evidence_checks(result, pages)
                if provider == "openai":
                    result = await _openai(prompt, api_key, model, max_out_tokens)
                    return _attach_evidence_checks(result, pages)
                if provider == "gemini":
                    result = await _gemini(prompt, api_key, model, max_out_tokens)
                    return _attach_evidence_checks(result, pages)
            raise ValueError(f"Unknown provider: {provider}")
        except Exception as e:
            last_err = e
            msg = str(e)
            if any(code in msg for code in ("503", "502", "529", "UNAVAILABLE", "overloaded")):
                wait = 5 * (attempt + 1)
                await asyncio.sleep(wait)
                continue
            raise
    raise last_err


async def _claude(prompt: str, api_key: str, model: str, max_out_tokens: int = 8192) -> dict:
    try:
        import anthropic
    except ImportError:
        raise RuntimeError("Run: pip install anthropic")
    client = anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model=model or "claude-sonnet-4-6",
        max_tokens=max_out_tokens,
        system="You are a research paper analyzer. Respond with valid JSON only, no markdown.",
        messages=[{"role": "user", "content": prompt}],
    )
    u = msg.usage
    logger.info("[Claude tokens] input=%d, output=%d, total=%d", u.input_tokens, u.output_tokens, u.input_tokens + u.output_tokens)
    result = _parse(msg.content[0].text)
    result['_usage'] = {'input': u.input_tokens, 'output': u.output_tokens, 'total': u.input_tokens + u.output_tokens}
    return result


async def _openai(prompt: str, api_key: str, model: str, max_out_tokens: int = 8192) -> dict:
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise RuntimeError("Run: pip install openai")
    client = AsyncOpenAI(api_key=api_key)
    resp = await client.chat.completions.create(
        model=model or "gpt-4o",
        messages=[
            {"role": "system", "content": "You analyze academic papers. Respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=max_out_tokens,
        response_format={"type": "json_object"},
    )
    u = resp.usage
    logger.info("[OpenAI tokens] input=%d, output=%d, total=%d", u.prompt_tokens, u.completion_tokens, u.total_tokens)
    result = _parse(resp.choices[0].message.content)
    result['_usage'] = {'input': u.prompt_tokens, 'output': u.completion_tokens, 'total': u.total_tokens}
    return result


async def _openai_compat(prompt: str, api_key: str, model: str,
                         max_out_tokens: int = 8192, base_url: str = None) -> dict:
    """OpenAI-compatible providers: DeepSeek, Groq, Mistral."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key, **({"base_url": base_url} if base_url else {}))
    resp = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You analyze academic papers. Respond with valid JSON only."},
            {"role": "user",   "content": prompt},
        ],
        max_tokens=max_out_tokens,
    )
    u = resp.usage
    logger.info("[%s tokens] input=%d, output=%d", model, u.prompt_tokens, u.completion_tokens)
    result = _parse(resp.choices[0].message.content)
    result['_usage'] = {'input': u.prompt_tokens, 'output': u.completion_tokens,
                        'total': u.prompt_tokens + u.completion_tokens}
    return result


async def _gemini(prompt: str, api_key: str, model: str, max_out_tokens: int = 8192) -> dict:
    try:
        from google import genai
        from google.genai import types as genai_types
    except ImportError:
        raise RuntimeError("Run: pip install google-genai")
    client = genai.Client(api_key=api_key)
    resp = client.models.generate_content(
        model=model or "gemini-2.5-flash",
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            max_output_tokens=max_out_tokens,
        ),
    )
    u = resp.usage_metadata
    logger.info("[Gemini tokens] input=%d, output=%d, total=%d", u.prompt_token_count, u.candidates_token_count, u.total_token_count)
    result = _parse(resp.text)
    result['_usage'] = {'input': u.prompt_token_count, 'output': u.candidates_token_count, 'total': u.total_token_count}
    return result


async def _claude_pdf(prompt: str, pdf_path: str, api_key: str, model: str, max_out_tokens: int = 8192) -> dict:
    try:
        import anthropic, base64
    except ImportError:
        raise RuntimeError("Run: pip install anthropic")
    with open(pdf_path, "rb") as f:
        pdf_b64 = base64.standard_b64encode(f.read()).decode()
    client = anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model=model or "claude-sonnet-4-6",
        max_tokens=max_out_tokens,
        system="You are a research paper analyzer. Respond with valid JSON only, no markdown.",
        messages=[{"role": "user", "content": [
            {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": pdf_b64}},
            {"type": "text", "text": prompt},
        ]}],
    )
    u = msg.usage
    logger.info("[Claude-PDF tokens] input=%d, output=%d", u.input_tokens, u.output_tokens)
    result = _parse(msg.content[0].text)
    result['_usage'] = {'input': u.input_tokens, 'output': u.output_tokens, 'total': u.input_tokens + u.output_tokens}
    return result


async def _openai_pdf(prompt: str, pdf_path: str, api_key: str, model: str, max_out_tokens: int = 8192) -> dict:
    try:
        import fitz
        from openai import AsyncOpenAI
        import base64
    except ImportError:
        raise RuntimeError("Run: pip install openai pymupdf")
    doc = fitz.open(pdf_path)
    images = []
    for i in range(min(len(doc), 20)):
        pix = doc[i].get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
        img_b64 = base64.b64encode(pix.tobytes("png")).decode()
        images.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}", "detail": "low"}})
    doc.close()
    client = AsyncOpenAI(api_key=api_key)
    resp = await client.chat.completions.create(
        model=model or "gpt-4o",
        messages=[
            {"role": "system", "content": "You analyze academic papers. Respond with valid JSON only."},
            {"role": "user", "content": images + [{"type": "text", "text": prompt}]},
        ],
        max_tokens=max_out_tokens,
        response_format={"type": "json_object"},
    )
    u = resp.usage
    logger.info("[OpenAI-PDF tokens] input=%d, output=%d", u.prompt_tokens, u.completion_tokens)
    result = _parse(resp.choices[0].message.content)
    result['_usage'] = {'input': u.prompt_tokens, 'output': u.completion_tokens, 'total': u.prompt_tokens + u.completion_tokens}
    return result


async def _gemini_pdf(prompt: str, pdf_path: str, api_key: str, model: str, max_out_tokens: int = 8192) -> dict:
    try:
        from google import genai
        from google.genai import types as genai_types
    except ImportError:
        raise RuntimeError("Run: pip install google-genai")
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()
    client = genai.Client(api_key=api_key)
    resp = client.models.generate_content(
        model=model or "gemini-2.5-flash",
        contents=[
            genai_types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
            prompt,
        ],
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            max_output_tokens=max_out_tokens,
        ),
    )
    u = resp.usage_metadata
    logger.info("[Gemini-PDF tokens] input=%d, output=%d", u.prompt_token_count, u.candidates_token_count)
    result = _parse(resp.text)
    result['_usage'] = {'input': u.prompt_token_count, 'output': u.candidates_token_count, 'total': u.prompt_token_count + u.candidates_token_count}
    return result


def _normalize_evidence_text(text: str) -> str:
    """Normalize text for rough quote matching across line breaks and punctuation."""
    if not text:
        return ""
    text = text.lower()
    # Normalize common curly quotes/dashes before stripping punctuation.
    text = (text.replace("“", '"').replace("”", '"')
                .replace("‘", "'").replace("’", "'")
                .replace("—", "-").replace("–", "-"))
    return re.sub(r"[\W_]+", "", text, flags=re.UNICODE)


def _find_evidence(fragment: str, pages: List[Dict], preferred_page=None) -> dict:
    """Return a lightweight evidence check for a claimed quote/text_hint."""
    quote = (fragment or "").strip().strip('"“”')
    if len(quote) < 8:
        return {
            "evidence_status": "not_checked",
            "evidence_page": None,
            "evidence_note": "引用太短，未验证",
        }

    page_items = [
        {"page": p.get("page"), "text": p.get("text") or ""}
        for p in (pages or [])
        if p.get("text")
    ]
    if not page_items:
        return {
            "evidence_status": "not_checked",
            "evidence_page": None,
            "evidence_note": "PDF 文本提取为空，无法验证",
        }

    # Check the preferred page first when the model supplied one.
    if preferred_page is not None:
        page_items.sort(key=lambda p: 0 if str(p["page"]) == str(preferred_page) else 1)

    quote_lower = quote.lower()
    for p in page_items:
        text_lower = p["text"].lower()
        pos = text_lower.find(quote_lower)
        if pos >= 0:
            raw = p["text"]
            snippet = raw[max(0, pos - 60): min(len(raw), pos + len(quote) + 60)]
            return {
                "evidence_status": "verified",
                "evidence_page": p["page"],
                "evidence_match": snippet.strip(),
                "evidence_note": "原文精确匹配",
            }

    norm_quote = _normalize_evidence_text(quote)
    if len(norm_quote) >= 8:
        for p in page_items:
            if norm_quote in _normalize_evidence_text(p["text"]):
                return {
                    "evidence_status": "verified",
                    "evidence_page": p["page"],
                    "evidence_match": "",
                    "evidence_note": "原文归一化匹配",
                }

    # Try partial chunks for longer quotes; useful when the model trims punctuation.
    if len(quote) >= 60:
        chunks = [quote[:80], quote[len(quote)//2: len(quote)//2 + 80], quote[-80:]]
        for chunk in chunks:
            norm_chunk = _normalize_evidence_text(chunk)
            if len(norm_chunk) < 16:
                continue
            for p in page_items:
                if norm_chunk in _normalize_evidence_text(p["text"]):
                    return {
                        "evidence_status": "verified",
                        "evidence_page": p["page"],
                        "evidence_match": "",
                        "evidence_note": "原文片段匹配",
                    }

    return {
        "evidence_status": "unverified",
        "evidence_page": None,
        "evidence_note": "未在提取文本中找到",
    }


def _attach_evidence_checks(result: dict, pages: List[Dict]) -> dict:
    """Attach local evidence verification metadata to AI-generated citations."""
    counts = {"verified": 0, "unverified": 0, "not_checked": 0}

    def add_count(check: dict):
        status = check.get("evidence_status", "not_checked")
        counts[status] = counts.get(status, 0) + 1

    for theme in result.get("themes") or []:
        for ref in theme.get("page_refs") or []:
            if isinstance(ref, dict):
                check = _find_evidence(ref.get("text_hint", ""), pages, ref.get("page"))
                ref.update(check)
                add_count(check)

        checked_citations = []
        for item in theme.get("citations") or []:
            if isinstance(item, str):
                quote = item
                obj = {"quote": quote}
            elif isinstance(item, dict):
                obj = item
                quote = item.get("quote") or item.get("text") or item.get("citation") or ""
            else:
                quote = str(item)
                obj = {"quote": quote}
            check = _find_evidence(quote, pages)
            obj.update(check)
            add_count(check)
            checked_citations.append(obj)
        if checked_citations:
            theme["citations"] = checked_citations

    checked_key_citations = []
    for item in result.get("key_citations") or []:
        if isinstance(item, str):
            obj = {"quote": item}
            quote = item
        elif isinstance(item, dict):
            obj = item
            quote = item.get("quote") or item.get("text") or item.get("citation") or ""
        else:
            obj = {"quote": str(item)}
            quote = str(item)
        check = _find_evidence(quote, pages)
        obj.update(check)
        add_count(check)
        checked_key_citations.append(obj)
    if checked_key_citations:
        result["key_citations"] = checked_key_citations

    result["_evidence"] = {
        **counts,
        "checked": sum(counts.values()),
        "extracted_chars": sum(len(p.get("text") or "") for p in (pages or [])),
    }
    return result


def _parse(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n?```\s*$", "", text, flags=re.MULTILINE)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            return json.loads(m.group())
        raise ValueError("AI response could not be parsed as JSON")
