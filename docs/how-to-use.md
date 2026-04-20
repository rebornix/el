# How to Use `el`

`el` runs an interactive terminal session connected to an AHP server.

## Start

```bash
node dist/index.js --server ws://localhost:8081
```

## Keyboard

- Type text and press `Enter` to send
- `↑/↓` to scroll
- `q` or `Ctrl+C` to exit

## Notes

- `el` shows loading/progress indicators while listing tunnels, creating sessions, and opening sessions.
- Session list rows include title, folder, and provider metadata.
- `el` attempts a best-effort live bootstrap from the server when it starts.
- Tool confirmation prompts use `y` / `n` when present.
