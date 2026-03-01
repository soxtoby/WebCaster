# WebCaster

Turn your favorite RSS feeds into a podcast. WebCaster is a self-hosted app that converts text articles into AI-narrated audio episodes you can subscribe to in your preferred podcast player.

## Features

### RSS to Podcast

Point WebCaster at any RSS or Atom feed and it generates a standard podcast feed with audio versions of every article. Subscribe to the output feed in Apple Podcasts, Pocket Casts, Overcast, or any other podcast app.

### Multiple TTS Providers

Choose from four text-to-speech providers — mix and match across feeds:

- **OpenAI** — 13 voices via the gpt-4o-mini-tts model
- **ElevenLabs** — hundreds of voices fetched dynamically
- **Inworld** — streaming chunked synthesis
- **Lemonfox** — 27 American & British voices (OpenAI-compatible API)

### Flexible Generation

- **On demand** — audio is generated the first time you download request an episode, saving on compute costs
- **Every episode** — all new articles are automatically narrated as they appear, so they're ready to listen right away

### Content Sources

- **Feed article** — uses the summary or full content from the RSS feed
- **Source page** — fetches the original article URL and extracts readable text

### Desktop Integration (Windows)

Runs as a system-tray app with one-click browser launch, and auto-updates from GitHub releases.

## Getting Started

```bash
bun install
bun start
```

Open in your browser, configure a TTS provider, add a feed, and start listening.
