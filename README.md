# WebCaster

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start
```

To manage database migrations:

```bash
bun run db:generate
```

This project was created using `bun init` in bun v1.3.8. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Feed management UI

The app includes a single-page RSS feed manager with feed list and feed details on the same screen.

- TTS provider settings open in a modal dialog over the main page.
- Supported providers: Inworld, OpenAI, ElevenLabs.
- Voice selector merges voices from configured providers and shows voice name, description, gender, and source.
- If a provider does not return gender, gender is inferred from voice name with `unknown` fallback.

Feed fields:
- Name
- RSS URL
- Voice (provider-scoped voice id)
- Language (`en`)

The UI follows the system color preference using `prefers-color-scheme`.

## API

- `GET /api/feeds`
- `POST /api/feeds`
- `PUT /api/feeds/:id`
- `DELETE /api/feeds/:id`

Feed data is stored locally in SQLite at `data/webcaster.sqlite`.
