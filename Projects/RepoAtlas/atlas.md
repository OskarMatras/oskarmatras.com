# Repo Atlas

30 hand-picked open-source repositories, grouped by the job they do. Verified against GitHub on 2026-10-15. Source: https://OskarMatras.com/Projects/RepoAtlas/

## Extend your agent

MCP servers, skills and docs that give an AI model hands, eyes and knowledge it was never trained on.

**Reach for it when:** the model has to touch a service (GitHub, a browser, a database), needs current library docs, or needs a packaged capability such as producing a .docx or .pptx.

**Decision rule:** Need current API docs: context7. Need GitHub: github-mcp-server. Need a browser: playwright-mcp. Need a repeatable procedure or document format: anthropics/skills. Building your own tool server: fastmcp. Need a server for service X: awesome-mcp-servers.

### [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) `OFFICIAL` `PICK`

Reference MCP servers maintained by the MCP project: filesystem, git, fetch, memory, sequential thinking and more.

- **Use when:** You want a known-good tool server, or a template for writing your own.
- **Tags:** mcp, reference, filesystem, git
- **Stats:** 91288 stars · JavaScript · MIT → Apache-2.0 · last push 2026-10-13

### [anthropics/skills](https://github.com/anthropics/skills) `OFFICIAL` `PICK`

Anthropic's public Agent Skills: folders of instructions and scripts that teach Claude a task, including creating .docx, .pdf, .pptx and .xlsx files.

- **Use when:** A task has a repeatable procedure (office documents, design, testing) that the agent should follow reliably.
- **Tags:** skills, documents, claude
- **Stats:** 181376 stars · Python · Per skill · last push 2026-10-09

### [upstash/context7](https://github.com/upstash/context7) `PICK`

MCP server that pulls version-specific, up-to-date library documentation straight into the prompt.

- **Use when:** The model keeps using outdated or invented APIs for a fast-moving library.
- **Tags:** docs, mcp, hallucination
- **Stats:** 63096 stars · TypeScript · MIT · last push 2026-10-15

### [github/github-mcp-server](https://github.com/github/github-mcp-server) `OFFICIAL`

GitHub's official MCP server: read repositories, search code, manage issues, pull requests and Actions.

- **Use when:** The agent has to work with GitHub beyond what plain git does.
- **Tags:** github, mcp, issues, pull-requests
- **Stats:** 33646 stars · Go · MIT · last push 2026-10-15

### [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) `OFFICIAL`

Playwright as an MCP server: the agent drives a real browser through structured page snapshots instead of screenshots.

- **Use when:** The agent must click, fill in and verify things in a web app.
- **Tags:** browser, mcp, testing
- **Stats:** 38202 stars · TypeScript · Apache-2.0 · last push 2026-10-08

### [PrefectHQ/fastmcp](https://github.com/PrefectHQ/fastmcp) `PICK`

The fast, Pythonic way to build MCP servers and clients: decorate a function and it becomes a tool.

- **Use when:** You want to expose your own script, API or database to an agent in under an hour.
- **Tags:** mcp, python, sdk
- **Stats:** 28089 stars · Python · Apache-2.0 · last push 2026-10-15

### [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)

The largest curated directory of MCP servers, grouped by what they connect to.

- **Use when:** You need an MCP server for a specific service and want to see what already exists.
- **Not for:** Quality varies a lot. Read a server's source before handing it credentials.
- **Tags:** directory, mcp, discovery
- **Stats:** 96397 stars · n/a · MIT · last push 2026-10-15

## Let agents code

Agents that read a whole codebase, change it and run it, plus the tool that makes sweeping changes safe.

**Reach for it when:** a task spans many files, needs to run commands and tests, or has to be handed off and left to finish.

**Decision rule:** Interactive work in the terminal: claude-code, or codex as a second opinion. Hand off a self-contained task to run unattended: OpenHands. Mechanical change across many call sites: ast-grep.

### [anthropics/claude-code](https://github.com/anthropics/claude-code) `OFFICIAL` `PICK`

Anthropic's agentic coding tool for the terminal: reads a codebase, edits files, runs commands, and extends through skills, hooks, subagents and MCP.

- **Use when:** You want an agent that works across a whole repository from the command line.
- **Not for:** Proprietary licence: the repository holds docs, issues and plugin examples, not the product source.
- **Tags:** agent, terminal, claude
- **Stats:** 151054 stars · TypeScript · Proprietary · last push 2026-10-15

### [openai/codex](https://github.com/openai/codex) `OFFICIAL`

OpenAI's open-source coding agent for the terminal: reads the repo, edits files and runs commands in a sandbox.

- **Use when:** You want a second, independent terminal agent, or you are already on OpenAI models.
- **Tags:** agent, terminal, openai
- **Stats:** 129387 stars · Rust · Apache-2.0 · last push 2026-10-15

### [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands)

Autonomous software-engineering agent that works inside a sandbox: writes code, runs commands and browses the web.

- **Use when:** You want to hand off a self-contained task and let it run in isolation.
- **Not for:** Overkill for quick edits where a terminal agent is enough.
- **Tags:** agent, sandbox, autonomous
- **Stats:** 90990 stars · TypeScript · MIT · last push 2026-10-15

### [ast-grep/ast-grep](https://github.com/ast-grep/ast-grep) `PICK`

Structural code search, lint and rewrite built on syntax trees instead of text, for many languages.

- **Use when:** A refactor touches hundreds of call sites and regex would be fragile.
- **Tags:** refactor, search, cli
- **Stats:** 16244 stars · Rust · MIT · last push 2026-10-15

## Reach the web

Fetch, drive and download from the live web, including the pages that have no API.

**Reach for it when:** the answer lives on a web page, behind a login, or inside a video.

**Decision rule:** Page content as clean text: firecrawl. Unknown steps on a site with no API: browser-use. Known steps or tests: playwright. Transcript, audio or metadata from a video: yt-dlp.

### [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) `PICK`

Turns websites into clean, LLM-ready markdown or structured data through crawl, scrape, search and extract APIs.

- **Use when:** An agent needs the contents of web pages, or a whole site, in readable form.
- **Tags:** scraping, crawling, markdown
- **Stats:** 191879 stars · TypeScript · AGPL-3.0 · last push 2026-10-15

### [browser-use/browser-use](https://github.com/browser-use/browser-use)

Python library that lets an LLM operate a real browser to finish multi-step tasks on sites that have no API.

- **Use when:** The job needs logging in, clicking through and filling in forms on a site you cannot call directly.
- **Tags:** browser, agent, automation
- **Stats:** 118091 stars · Python · MIT · last push 2026-10-15

### [microsoft/playwright](https://github.com/microsoft/playwright) `PICK`

Reliable cross-browser automation and testing in code, for Chromium, Firefox and WebKit.

- **Use when:** You need deterministic scripted browsing, scraping of JavaScript-heavy pages, or end-to-end tests.
- **Not for:** The steps are not known in advance. Use browser-use instead.
- **Tags:** browser, testing, scraping
- **Stats:** 97789 stars · TypeScript · Apache-2.0 · last push 2026-10-15

### [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp) `PICK`

Command-line downloader for video and audio from thousands of sites that also fetches metadata and subtitles.

- **Use when:** You need a transcript, subtitle track, audio or metadata from a video page.
- **Not for:** Only for content you have the right to download.
- **Tags:** video, audio, transcripts, cli
- **Stats:** 198066 stars · Python · Unlicense · last push 2026-10-10

## Read any document

Turn PDFs, Office files and scans into text a model can use, and turn text back into deliverables.

**Reach for it when:** the input is a file rather than text, or the output has to be a specific file format.

**Decision rule:** Any file to quick text: markitdown. Tables and layout must survive: docling. Converting between document formats: pandoc.

### [microsoft/markitdown](https://github.com/microsoft/markitdown) `PICK`

Converts Office files, PDFs, images, audio, HTML and more into Markdown that language models read well.

- **Use when:** You want one call that turns almost any file into model-ready text.
- **Tags:** markdown, pdf, office, convert
- **Stats:** 190414 stars · Python · MIT · last push 2026-10-04

### [docling-project/docling](https://github.com/docling-project/docling)

Layout-aware document parsing that keeps tables, reading order and structure from PDFs and Office files.

- **Use when:** Tables and layout matter, as in financial reports and scientific papers.
- **Tags:** pdf, tables, parsing, rag
- **Stats:** 68938 stars · Python · MIT · last push 2026-10-15

### [jgm/pandoc](https://github.com/jgm/pandoc) `PICK`

The universal document converter: Markdown, HTML, LaTeX, docx, EPUB and dozens of other formats in either direction.

- **Use when:** You need to produce or convert a deliverable format from plain text.
- **Tags:** convert, markdown, docx, latex
- **Stats:** 46601 stars · Haskell · GPL-2.0 · last push 2026-10-15

## Build agents and AI apps

Frameworks and plumbing for putting a model inside your own product.

**Reach for it when:** you are writing code that calls a model, uses tools, or has to keep state across steps.

**Decision rule:** Stateful multi-step agent: langgraph. Typed, validated outputs in Python: pydantic-ai. AI feature in a TypeScript or React app: vercel/ai. Many providers behind one API: litellm.

### [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) `PICK`

Low-level framework for stateful, long-running agents modelled as graphs, with persistence and human-in-the-loop steps.

- **Use when:** You are building a multi-step agent that needs state, branching, retries and checkpoints.
- **Tags:** agents, python, orchestration
- **Stats:** 43321 stars · Python · MIT · last push 2026-10-15

### [pydantic/pydantic-ai](https://github.com/pydantic/pydantic-ai)

Type-safe Python agent framework from the Pydantic team: validated structured outputs and tools across model providers.

- **Use when:** You want agents with typed, validated outputs and a small API.
- **Tags:** agents, python, structured-output
- **Stats:** 20644 stars · Python · MIT · last push 2026-10-15

### [vercel/ai](https://github.com/vercel/ai) `PICK`

The AI SDK for TypeScript: one API for text, structured output, tools and streaming UI across providers.

- **Use when:** You are adding an AI feature to a TypeScript or React web app.
- **Tags:** typescript, streaming, web
- **Stats:** 27335 stars · TypeScript · Apache-2.0 · last push 2026-10-15

### [BerriAI/litellm](https://github.com/BerriAI/litellm)

One OpenAI-style interface, as SDK or proxy, to 100+ model providers, with fallbacks and spend tracking.

- **Use when:** You want to swap or mix models without rewriting code.
- **Tags:** gateway, providers, proxy
- **Stats:** 61330 stars · Python · MIT + enterprise · last push 2026-10-15

## Automate and run locally

Run models on your own machine and wire work together so it happens without you.

**Reach for it when:** the job should run on a schedule or trigger, offline, or on private data.

**Decision rule:** Triggers and glue between apps: n8n. A private or offline model: ollama. Transcribe audio: faster-whisper. Generate images or video in a repeatable pipeline: ComfyUI.

### [n8n-io/n8n](https://github.com/n8n-io/n8n) `PICK`

Workflow automation with hundreds of integrations, AI nodes and a visual editor, self-hostable.

- **Use when:** You want triggers, schedules and glue between apps without writing a service.
- **Not for:** Fair-code licence, not OSI open source.
- **Tags:** automation, workflow, self-host
- **Stats:** 207517 stars · TypeScript · Sustainable Use · last push 2026-10-15

### [ollama/ollama](https://github.com/ollama/ollama) `PICK`

Run open language models locally with one command and an OpenAI-compatible API.

- **Use when:** You need a private, offline or free-to-call model.
- **Tags:** local, llm, inference
- **Stats:** 183301 stars · Go · MIT · last push 2026-10-15

### [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) `PICK`

Fast reimplementation of Whisper speech-to-text on CTranslate2.

- **Use when:** You need accurate transcripts of recordings, locally.
- **Tags:** speech, transcription, audio
- **Stats:** 25878 stars · Python · MIT · last push 2026-10-15

### [Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI)

Node-based engine for image, video and audio generation with a huge ecosystem of models and custom nodes.

- **Use when:** You need repeatable, scriptable image or video generation pipelines.
- **Tags:** images, diffusion, workflow
- **Stats:** 137700 stars · Python · GPL-3.0 · last push 2026-10-15

## Terminal superpowers

Small, sharp command-line tools that agents and humans both lean on every day.

**Reach for it when:** you are searching, reshaping or converting things at the command line.

**Decision rule:** Find text in files: ripgrep. Run a Python script with its dependencies: uv. Reshape JSON: jq. Convert or cut audio and video: ffmpeg.

### [BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep) `PICK`

Very fast recursive text search that respects .gitignore.

- **Use when:** Searching a large codebase or a folder of logs.
- **Tags:** search, cli, rust
- **Stats:** 69132 stars · Rust · Unlicense · last push 2026-08-04

### [astral-sh/uv](https://github.com/astral-sh/uv) `PICK`

Extremely fast Python package and project manager that also runs single-file scripts with inline dependencies.

- **Use when:** Running or sharing Python scripts without setting up an environment first.
- **Tags:** python, packaging, cli
- **Stats:** 90800 stars · Rust · Apache-2.0 · last push 2026-10-15

### [jqlang/jq](https://github.com/jqlang/jq)

Command-line JSON processor for filtering, reshaping and extracting data.

- **Use when:** Taming API responses and JSON logs.
- **Tags:** json, cli
- **Stats:** 35826 stars · C · MIT · last push 2026-10-13

### [FFmpeg/FFmpeg](https://github.com/FFmpeg/FFmpeg) `PICK`

The complete toolkit for converting, trimming, merging and processing audio and video.

- **Use when:** Any media conversion, extraction or editing task.
- **Tags:** video, audio, convert, cli
- **Stats:** 65233 stars · C · LGPL / GPL · last push 2026-10-15
