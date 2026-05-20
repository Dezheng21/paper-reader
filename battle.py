"""Paper-reader KnowKnow dialogue engine."""

import json

# ── 系统提示词 ────────────────────────────────────────────────────────────────

PAPER_ATTACK_PROMPT = """\
你是 KnowKnow，一个简洁、冷静、可靠的论文理解检查助手。用户刚刚读了一篇论文，你要用少量问题帮助他们确认自己是否掌握了论文的核心论证。

输出语言：{language}。除非用户明确要求切换语言，否则所有回复都使用这个语言。

【论文信息】
标题：{title}
核心问题：{core_question}
关键洞见：{key_insight}
主要论点：
{themes}

工作原则：
- 每次只问一个问题，不超过三句话。
- 先接住用户已经说清楚的部分，再指出一个需要澄清的地方。
- 听到照搬摘要的回答，请用户换成自己的话。
- 听到结论，追问支撑它的证据或因果机制。
- 听到观点，追问适用边界：这个结论在什么条件下不成立。
- 用户回答质量提升时，先简短确认，再进入下一层问题。

检查层级：
  第一层 → 论文说了什么（核心主张、方法、发现）
  第二层 → 为什么这样（因果机制、实验逻辑）
  第三层 → 所以呢（迁移、反例、局限性）

语气：短、清楚、低压力。不要像审问，不要表演严厉。像一个成熟助手在研究讨论中帮用户校准理解。\
"""

PAPER_CHAT_PROMPT = """\
你是 KnowKnow，一个简洁、可靠的论文问答助手。用户会围绕这篇论文提出问题，你要帮助他们理解论文内容。

输出语言：{language}。除非用户明确要求切换语言，否则所有回复都使用这个语言。

【论文信息】
标题：{title}
核心问题：{core_question}
关键洞见：{key_insight}
主要论点：
{themes}

工作方式：
- 先直接回答用户的问题。
- 解释必须结合论文的具体内容，不要泛泛而谈。
- 如果论文没有直接回答，请说明边界。
- 可以用类比，但要指出类比的局限。
- 如果用户理解有偏差，温和修正："这个方向可以，但论文里的意思更具体一点……"
- 必要时最后补一个小问题，帮助用户继续想。

语气：短、清楚、低情绪负担。不要过度人格化，不要长篇讲课。
格式：先回答，再补充依据或边界；总共不超过五句话。\
"""

COMPANION_PROMPT = """\
你是 KnowKnow 的提示功能。用户在论文问答或理解检查中卡住了，你要给一个短提示，帮助他继续。

输出语言：{language}。除非用户明确要求切换语言，否则所有回复都使用这个语言。

原则：
- 绝不直接给出答案
- 每次只提供一种支架（根据情况选最合适的）：
    a) 类比："这篇论文的逻辑其实像___"
    b) 句式模板："用这个结构回答：[___]导致[___]，因为[___]"
    c) 二选一："你认为作者的核心立场更接近A还是B？先选一个"
    d) 回到论文："回去找第___部分，看作者怎么解释___"
- 支架结束后，固定用"你可以基于这个提示继续。"收尾
- 整体不超过三句话\
"""

SUMMARY_PROMPT = """\
根据下面的对话，提炼用户对这篇论文的理解情况。

论文标题：{title}
输出语言：{language}

对话记录：
{conversation}

只输出以下JSON，不要任何其他内容：
{{
  "sticking_point":  "用户需要澄清的地方（一句话，说明是哪个概念或论点还不清楚）",
  "card_before":     "用户最初对这篇论文的粗浅理解（以"我以前以为"开头）",
  "card_after":      "经过本轮对话后的新理解（以"现在我发现"开头）",
  "card_therefore":  "这篇论文的洞见可以用来解释的现象（以"所以当看到___时"开头）",
  "next_attack":     "下一步最值得澄清的问题（一句具体问句）"
}}\
"""

# ── 内部调用 ──────────────────────────────────────────────────────────────────

def _call(provider: str, api_key: str, model: str,
          system: str, history: list) -> str:
    """统一调用接口，history = [{"role":"user"|"assistant", "content":"..."}]"""

    RETRY_SIGNALS = ("429", "rate", "quota", "503", "overloaded", "UNAVAILABLE")

    if provider == "gemini":
        from google import genai
        from google.genai import types
        models = [model] if model else ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"]
        # 把 history 转成 Gemini contents 格式
        contents = [
            {"role": "model" if m["role"] == "assistant" else "user",
             "parts": [{"text": m["content"]}]}
            for m in history
        ]
        client = genai.Client(api_key=api_key)
        last_err = None
        for m in models:
            try:
                resp = client.models.generate_content(
                    model=m, contents=contents,
                    config=types.GenerateContentConfig(system_instruction=system),
                )
                return resp.text
            except Exception as e:
                if any(s in str(e) for s in RETRY_SIGNALS):
                    last_err = e; continue
                raise
        raise last_err or RuntimeError("Gemini 不可用")

    elif provider == "claude":
        import anthropic
        m = model or "claude-haiku-4-5-20251001"
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model=m, max_tokens=1024,
            system=system, messages=history,
        )
        return resp.content[0].text

    elif provider in ("openai", "deepseek", "groq", "mistral"):
        import openai
        BASE_URLS = {
            "deepseek": "https://api.deepseek.com",
            "groq":     "https://api.groq.com/openai/v1",
            "mistral":  "https://api.mistral.ai/v1",
            "openai":   None,
        }
        DEFAULT_MODELS = {
            "deepseek": "deepseek-chat",
            "groq":     "llama-3.3-70b-versatile",
            "mistral":  "mistral-small-latest",
            "openai":   "gpt-4o-mini",
        }
        base_url = BASE_URLS.get(provider)
        m = model or DEFAULT_MODELS.get(provider, "gpt-4o-mini")
        client = openai.OpenAI(api_key=api_key, **({"base_url": base_url} if base_url else {}))
        msgs = [{"role": "system", "content": system}] + history
        resp = client.chat.completions.create(model=m, messages=msgs)
        return resp.choices[0].message.content

    raise ValueError(f"未知服务商: {provider}")


def _parse_json(text: str) -> dict:
    text = text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.split("```")[0].strip()
    return json.loads(text)


# ── KnowKnow dialogue functions ───────────────────────────────────────────────

def _build_system(paper_context: dict, topic: str, mode: str, language: str = "Chinese") -> str:
    themes_text = "\n".join(
        f"- {t.get('heading', '')}: {t.get('narrative', '')[:100]}"
        for t in paper_context.get("themes", [])[:5]
    ) or "（暂无主题信息）"
    template = PAPER_CHAT_PROMPT if mode == "chat" else PAPER_ATTACK_PROMPT
    return template.format(
        title         = paper_context.get("title", topic),
        core_question = paper_context.get("core_question", ""),
        key_insight   = paper_context.get("key_insight", ""),
        themes        = themes_text,
        language      = language or "Chinese",
    )


def attack_first(topic: str, paper_context: dict,
                 provider: str, api_key: str, model: str = "",
                 mode: str = "battle", language: str = "Chinese") -> str:
    system = _build_system(paper_context, topic, mode, language)
    if mode == "chat":
        opening = "你好，我在读这篇论文，有些地方想弄懂，可以问你吗？"
    else:
        opening = f"我刚读了这篇论文。我的初步理解是：{paper_context.get('key_insight', '还不太清楚')}"
    history = [{"role": "user", "content": opening}]
    return _call(provider, api_key, model, system, history)


def attack_reply(topic: str, paper_context: dict, history: list,
                 provider: str, api_key: str, model: str = "",
                 mode: str = "battle", language: str = "Chinese") -> str:
    system = _build_system(paper_context, topic, mode, language)
    trimmed = (history[:2] + history[-6:]) if len(history) > 8 else history
    return _call(provider, api_key, model, system, trimmed)


def companion_help(topic: str, stuck_on: str,
                   provider: str, api_key: str, model: str = "",
                   language: str = "Chinese") -> str:
    history = [{"role": "user",
                "content": f"论文：「{topic}」\n我卡在：{stuck_on}\n请给我一个支架。"}]
    system = COMPANION_PROMPT.format(language=language or "Chinese")
    return _call(provider, api_key, model, system, history)


def summarize(topic: str, history: list,
              provider: str, api_key: str, model: str = "",
              language: str = "Chinese") -> dict:
    conv = "\n".join(
        f"{'AI' if m['role'] == 'assistant' else '用户'}：{m['content']}"
        for m in history
    )
    prompt = SUMMARY_PROMPT.format(title=topic, language=language or "Chinese", conversation=conv[:4000])
    try:
        text = _call(provider, api_key, model, "",
                     [{"role": "user", "content": prompt}])
        return _parse_json(text)
    except Exception:
        return {
            "sticking_point": "（总结失败，请手动填写）",
            "card_before":    "我以前以为",
            "card_after":     "现在我发现",
            "card_therefore": "所以当看到___时",
            "next_attack":    "（待定）",
        }
