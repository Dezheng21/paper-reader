# Paper Reader — User Guide

**AI-Powered PDF Paper Reading & Analysis Tool**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting a Gemini API Key](#2-getting-a-gemini-api-key)
3. [Installation](#3-installation)
4. [Launching the App](#4-launching-the-app)
5. [Configuring Your API Key](#5-configuring-your-api-key)
6. [Features](#6-features)
7. [FAQ](#7-faq)

---

## 1. Introduction

**Paper Reader** is a locally-run AI tool for reading and analyzing academic papers.

- Upload a PDF and let AI generate a reading guide, structured notes, or critical analysis
- Supports Claude · OpenAI · Gemini — three major AI providers
- Runs entirely on your machine — your PDFs and notes are never uploaded to any server

---

## 2. Getting a Gemini API Key

> **Why Gemini?** Generous free tier, no credit card required. New users get ~15 calls per minute at no cost.

### Step-by-Step

**① Open Google AI Studio**

Visit in your browser: **https://aistudio.google.com**

---

**② Sign in with your Google account**

Click「Sign in」in the top-right corner and log in with your Google account.

> Don't have a Google account? Sign up for free at https://accounts.google.com/signup

---

**③ Create an API Key**

After logging in, click **「Get API key」** in the left sidebar.

→ Click the blue **「Create API key」** button

→ In the dialog, select「**Create API key in new project**」

---

**④ Copy the API Key**

Your key will appear on screen, starting with `AIza`. Example:

```
AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567
```

Click the **copy icon（📋）** next to the key, or manually select and copy it.

> ⚠️ **Important:** The key is only shown once. Save it immediately in a safe place (e.g. Notes app).

---

**⑤ Free Tier Limits**

| Model | Free Limit | Recommended Use |
|-------|-----------|----------------|
| gemini-2.5-flash | 500/day, 15/min | Daily use (recommended) |
| gemini-2.5-pro | 25/day | When higher accuracy is needed |

---

## 3. Installation

### System Requirements

| Platform | Requirements |
|----------|-------------|
| Mac | macOS 12 or later, Python 3.9+ |
| Windows | Windows 10/11, Python 3.9+ |
| Browser | Chrome · Safari · Firefox · Edge |

---

### Mac Installation

#### Step 1: Install Python (skip if already installed)

Open Terminal (Spotlight search for "Terminal") and type:

```bash
python3 --version
```

If you see `Python 3.x.x`, you're good. If not, download from:

**https://www.python.org/downloads/macos/**

---

#### Step 2: Run the install script

**Double-click** `mac/install.command`

If macOS blocks it: **right-click the file → Open → click Open** in the security dialog.

A terminal window will open and install all dependencies (about **2–5 minutes**). Close it when you see the success message.

---

#### Step 3: Build the .app

**Double-click** `mac/build.sh` (handle any security block the same way: right-click → Open)

When done, the `dist/` folder will contain:
- `论文阅读助手.app` — the application
- `论文阅读助手-Mac.dmg` — a distributable disk image

Drag the `.app` into your **Applications** folder to complete installation.

---

### Windows Installation

#### Step 1: Install Python (skip if already installed)

Open Command Prompt (Win+R, type `cmd`) and run:

```
python --version
```

If Python is not found:

1. Go to **https://www.python.org/downloads/windows/**
2. Download the latest installer (e.g. `python-3.12.x-amd64.exe`)
3. Run the installer — **make sure to check「Add Python to PATH」**
4. Re-open Command Prompt and verify

---

#### Step 2: Run the install script

**Double-click** `windows\install.bat`

A Command Prompt window will open and install all dependencies (about **2–5 minutes**). Close it when you see the success message.

---

#### Step 3: Build the .exe

**Double-click** `windows\build.bat`

When done, the `dist\` folder will contain:
- `PaperReader\PaperReader.exe` — the application
- `PaperReader-Windows.zip` — a distributable zip archive

Unzip the archive and double-click `PaperReader.exe` to run.

---

## 4. Launching the App

| Platform | How to launch |
|----------|--------------|
| Mac | Double-click「论文阅读助手.app」|
| Windows | Double-click「PaperReader.exe」|

A small status window will appear showing「✓ Service is running」and your browser will **open automatically**.

- Click **「Open Browser」** to reopen the interface at any time
- Click **「Quit」** or close the status window to fully exit the app

> If the browser doesn't open automatically, navigate to `http://127.0.0.1:8000/`

---

## 5. Configuring Your API Key

On first launch, you need to enter your API Key:

1. Click **「⚙ Settings」** in the top-right corner
2. Under **「AI Provider」**, select **「Gemini (Google)」**
3. Paste your API Key into the **「API Key」** field
4. Click **「Validate」** to confirm the key works (a ✓ means success)
5. Choose your preferred **「Output Language」** for AI analysis
6. Click **「Save」**

> Your API Key is stored locally in your browser only — it is never sent to any server.

---

## 6. Features

### Opening a Paper

- Click **「Open Paper」** in the top bar to select a PDF file
- Or **drag and drop** a PDF directly onto the viewer area

### Analysis Modes

Click **「Analyze」** and choose your reading goal:

| Mode | Best for |
|------|---------|
| Quick overview | Get the main argument fast, no deep reading planned |
| Pre-reading navigation | Preparing to read closely, need the logical structure |
| I have a specific question | Goal-oriented reading focused on your question |
| Structured reading notes | Deep digestion of a key paper |
| Critical analysis | Evaluate credibility, simulate peer review |
| Research extension | Find angles for your own research |

### Other Features

| Feature | How to use |
|---------|-----------|
| Search in PDF | `Ctrl+F` (Windows) / `Cmd+F` (Mac) |
| Copy text | Select text with mouse → click「Copy」|
| Add note | Select text with mouse → click「Add Note」|
| Export notes | Sidebar「↓ Export」→ Markdown file |
| PDF → Markdown | Top bar「PDF → MD」button |
| Library | Save papers and analysis results, reload anytime |
| Interface language | Top bar dropdown — 9 languages supported |
| Multiple tabs | Top bar「＋」button — open several papers at once |

---

## 7. FAQ

**Q: Mac shows "Apple cannot verify this app for malicious software" — what do I do?**

A: **Right-click the `.app` → Open → click Open** in the security dialog. This message only appears once; after that you can double-click normally.

---

**Q: Installation gives a "pip network timeout" error?**

A: Switch to a faster pip mirror and retry:

```bash
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
```

---

**Q: Windows says "Python not found" even though I installed it?**

A: Reinstall Python and make sure to check **「Add Python to PATH」** at the bottom of the installer. Then **reopen** Command Prompt.

---

**Q: Browser shows "This site can't be reached" after launch?**

A: Wait about 10 seconds for the server to fully start, then refresh the page. If it still doesn't work, close the status window and relaunch the app.

---

**Q: API Key validation fails?**

A: Check the following:
1. The key was copied in full (no extra spaces)
2. A Gemini key starts with `AIza`
3. Your account is activated in AI Studio

---

**Q: Analysis results are in the wrong language — how do I change it?**

A: Settings → 「Output Language」→ select your language → Save → re-run the analysis.

---

**Q: How do I uninstall?**

A: Simply delete the `paper-reader` folder (or the `.app` file on Mac). No system-level changes are made.

---

## Contact & Feedback

If you run into any issues, please open a GitHub Issue with a screenshot and your OS version.

---

*This software is fully open-source. API Keys are obtained by users directly. No personal data is collected.*
