# YTSummarizer

An Obsidian plugin that fetches YouTube transcripts and generates AI-powered summaries using multiple LLM providers — OpenAI, DeepSeek, 智谱 GLM, Google Gemini, Ollama (local), or any OpenAI-compatible endpoint.

## Screenshots

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/lwx1224567/ytsummarizer/main/assets/example_1.png" alt="YTSummarizer - Transcript View" width="400"/><br><em>Transcript View in Sidebar</em></td>
    <td><img src="https://raw.githubusercontent.com/lwx1224567/ytsummarizer/main/assets/example_2.png" alt="YTSummarizer - Summary Generation" width="400"/><br><em>Summary Generation with AI</em></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><img src="https://raw.githubusercontent.com/lwx1224567/ytsummarizer/main/assets/example_img_3.png" alt="YTSummarizer - Settings" width="600"/><br><em>Plugin Settings — Multi-Provider Configuration</em></td>
  </tr>
</table>

## Features

### Core
- **Fetch transcripts** from any YouTube video with automatic language detection and fallback
- **AI-powered summaries** using your choice of LLM backend
- **Streaming output** — text appears incrementally in your note as the LLM generates it, rather than waiting for the full response
- **Map-Reduce segmented summarization** — long transcripts are automatically split into chunks, each summarized independently, then merged into a coherent final summary (no more context-window limits)
- **Multi-language translation** — output the summary in English, Chinese, Japanese, Korean, Spanish, French, German, or auto-detect
- **Dual view modes** — view transcripts in the sidebar or create persistent Markdown notes
- **Interactive timestamps** — click any timestamp to jump directly to that point in the video
- **Search & filter** — search within transcripts with highlight support
- **Drag & copy** — drag transcript blocks into your notes, or copy all with one click

### LLM Providers (6 built-in presets)

| Provider | Pricing | Notes |
|----------|---------|-------|
| **OpenAI** | Paid (GPT-4o Mini / GPT-4o) | Default, requires API key |
| **DeepSeek** | Very cheap (DeepSeek-V3 / R1) | Requires API key |
| **智谱 GLM** | Free tier available (GLM-4-Flash) | Requires API key |
| **Google Gemini** | Free tier available (Gemini 2.0 Flash) | Requires API key |
| **Ollama** | Completely free, runs locally | No API key needed, offline-capable |
| **Custom** | Depends on endpoint | Any OpenAI-compatible API (LM Studio, vLLM, etc.) |

All providers share a unified architecture via the OpenAI-compatible protocol — switching backends is just a dropdown change.

### Resiliency
- **Stream → non-streaming fallback**: if streaming fails, automatically retries with non-streaming mode, preserving any partial output already received
- **60-second timeout guard**: prevents infinite hangs on unresponsive endpoints
- **Chunk-level error isolation**: in segmented mode, one failed chunk doesn't block the rest; error markers are appended instead
- **Configurable token threshold**: control when the plugin switches from single-call to segmented (map-reduce) mode

## Installation

### From Community Plugins
1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "YTSummarizer"
4. Install and enable the plugin

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/lwx1224567/ytsummarizer/releases)
2. Copy them into `{vault}/.obsidian/plugins/yt-summarizer/`
3. Restart Obsidian and enable the plugin in Settings

## Usage

### Getting Transcripts

There are three ways to trigger the plugin:

1. **Ribbon icon** — Click the YouTube icon in the left sidebar, paste a URL, and choose "Show in sidebar" or "Create new page"

2. **Selected text** — Highlight a YouTube URL in any note, then run the command `YTSummarizer: Get YouTube transcript from selected url`

3. **Command palette** — `Ctrl/Cmd + P` → `YTSummarizer: Get YouTube transcript from url prompt` → paste URL → choose view mode

### View Modes

| Mode | Behavior |
|------|----------|
| **Sidebar** | Transcript appears in the right sidebar. Click "Generate Summary" to manually trigger AI summarization. Good for quick previews. |
| **New Page** | Creates a `.md` note with the transcript (collapsed) and an auto-generated AI summary at the top. Summary streams in real-time, or uses segmented mode for long videos. Good for permanent knowledge capture. |

### Working with Transcripts

- Click any timestamp to open the video at that exact moment
- Click any transcript line to copy it to clipboard
- Right-click a block → "Copy all" to copy the entire transcript with timestamps
- Type in the search box to filter transcript lines (matches are highlighted)
- Drag transcript blocks into other notes

## Configuration

### Transcript Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **UI Language** | Settings interface language (English / 中文) | English |
| **Timestamp interval** | How often timestamps appear (1 = every line, 10 = every 10 lines) | 5 |
| **Language** | Preferred subtitle language code (e.g., `en`, `zh`, `ja`) | `en` |
| **Country** | Preferred subtitle country code (e.g., `EN`, `CN`, `JP`) | `EN` |

### LLM Settings

| Setting | Description |
|---------|-------------|
| **Provider** | Choose from 6 presets: OpenAI, DeepSeek, 智谱 GLM, Gemini, Ollama, or Custom |
| **API Base URL** | Endpoint URL. Auto-filled when selecting a preset; override for custom/proxy endpoints |
| **API Key** | Your provider's API key. Not required for Ollama (local) |
| **Model** | Model name — dropdown selection for fixed-model presets, free text for Ollama/Custom |
| **Custom Summary Prompt** | Override the system prompt used for summarization. Supports `{title}` and `{url}` placeholders |
| **Max Tokens** | Maximum output tokens per summary call (10–10000) | 1000 |
| **Segmented Threshold** | Token threshold above which the plugin switches to map-reduce mode. Lower values trigger segmentation more often. Set higher if your model has a large context window | 4000 |
| **Target Language** | Output summary language. LLM will translate the content to the selected language. "Auto" keeps the original transcript language | English |

### Provider Setup Examples

<details>
<summary><b>OpenAI</b></summary>

1. Select "OpenAI" as the provider
2. Get an API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
3. Choose a model (GPT-4o Mini recommended for cost/speed balance)
</details>

<details>
<summary><b>DeepSeek (very cheap)</b></summary>

1. Select "DeepSeek" as the provider
2. Get an API key from [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
3. `deepseek-chat` is the recommended model
</details>

<details>
<summary><b>智谱 GLM (free tier)</b></summary>

1. Select "智谱 GLM" as the provider
2. Get an API key from [open.bigmodel.cn](https://open.bigmodel.cn/usercenter/apikeys)
3. `glm-4-flash` is free — no cost for light usage
</details>

<details>
<summary><b>Google Gemini (free tier)</b></summary>

1. Select "Google Gemini" as the provider
2. Get an API key from [aistudio.google.com](https://aistudio.google.com/apikey)
3. `gemini-2.0-flash` recommended for speed
</details>

<details>
<summary><b>Ollama (local, fully offline)</b></summary>

1. Install [Ollama](https://ollama.com) and pull a model: `ollama pull qwen2.5`
2. Make sure Ollama is running (`ollama serve` or the desktop app)
3. Select "Ollama" as the provider — no API key needed
4. Type your model name (e.g., `qwen2.5`, `llama3.2`, `deepseek-r1:7b`)
</details>

<details>
<summary><b>Custom (any OpenAI-compatible endpoint)</b></summary>

1. Select "Custom" as the provider
2. Enter the endpoint URL (e.g., `http://localhost:1234/v1` for LM Studio)
3. Enter the model name and API key as needed
</details>

## Requirements

- Obsidian >= 1.7.2
- An API key for your chosen LLM provider (not required for Ollama)
- Internet connection (not required for Ollama)

## Security and Best Practices

This plugin follows Obsidian's security guidelines:

- Uses DOM API instead of `innerHTML` for safer content rendering
- Properly handles resources in the plugin lifecycle
- Uses CSS classes for styling instead of inline styles
- Implements proper error handling and user feedback
- API keys are stored locally in Obsidian's `data.json` and never transmitted except to your configured endpoint

## Architecture

```
YouTube URL
    │
    ▼
fetch-transcript.ts          ← Parse YouTube page, extract caption XML
    │
    ├──→ transcript-view.ts  ← Sidebar: render timestamps, search, copy
    │
    └──→ main.ts             ← New page: build Markdown, route to LLM
              │
              ▼
         llm/llm-service.ts  ← Factory: createLLMProvider()
              │
              ▼
    llm/openai-compatible-provider.ts
       ├── generateSummary()            ← Non-streaming (fallback)
       ├── generateSummaryStream()      ← Streaming (primary)
       └── generateSegmentedSummary()   ← Map-Reduce (long transcripts)
```

## Acknowledgments

Many thanks to the creators and contributors of these plugins:

- [YTranscript](https://github.com/lstrzepek/obsidian-yt-transcript) — This plugin builds upon the YTranscript plugin by Łukasz Strzępek, which provides the foundation for fetching and displaying YouTube transcripts. YTSummarizer extends it with AI summarization, multi-provider support, streaming output, and segmented processing.
- [Auto Link Title](https://github.com/zolrath/obsidian-auto-link-title)
- [Timestamp Notes](https://github.com/juliang22/ObsidianTimestampNotes)
- [Recent Files](https://github.com/tgrosinger/recent-files-obsidian)

## What sets YTSummarizer apart?

Unlike other YouTube-related plugins for Obsidian, YTSummarizer focuses on:

1. **AI-powered summaries with 6 LLM backends** — from cloud (OpenAI, DeepSeek, 智谱, Gemini) to fully local (Ollama), with unified configuration
2. **Streaming + Map-Reduce architecture** — short transcripts stream in real-time; long transcripts are auto-split, summarized in parallel, and merged
3. **Resilient by design** — stream→non-streaming fallback, timeout guards, chunk-level error isolation, partial-output preservation
4. **Multi-language translation** — summaries can be generated in 7 languages regardless of the original transcript language
5. **Flexible viewing options** — quick sidebar preview or permanent Markdown notes in your knowledge base
6. **Privacy options** — Ollama support means you can run everything locally with zero data leaving your machine

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
