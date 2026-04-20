# Getting Started

## Requirements

- Node.js 20+
- An Agent Host Protocol (AHP) server (WebSocket endpoint)

## Install

```bash
npm install
npm run build
```

## Run

```bash
node dist/index.js --server ws://localhost:8081
```

## CLI flags

- `--server <ws://...>`: connect directly to an AHP server
