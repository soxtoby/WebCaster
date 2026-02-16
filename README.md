# WebCaster

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start
```

This project was created using `bun init` in bun v1.3.8. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Feed management UI

The app includes a single-page RSS feed manager with feed list and feed details on the same screen.

Fields:
- Name
- RSS URL
- Voice (`default`)
- Language (`en`)

The UI follows the system color preference using `prefers-color-scheme`.

## API

- `GET /api/feeds`
- `POST /api/feeds`
- `PUT /api/feeds/:id`
- `DELETE /api/feeds/:id`

Feed data is stored locally in SQLite at `data/webcaster.sqlite`.
