# Spec: Dev Tunnels Support

## Goal

Allow `el` to connect to an AHP server via Microsoft Dev Tunnels.

## Scope

- Connect by tunnel name
- Authenticate with GitHub or Microsoft token
- Show a tunnel picker when needed

## CLI

- `--tunnel <name>`
- `--tunnel-token <token>`
- `--tunnel-auth <github|microsoft>`

## Expected behavior

- If tunnel auth is missing/expired, prompt for auth flow
- If tunnel resolves, connect and start normal app flow
- If tunnel cannot be resolved, show a clear error message
