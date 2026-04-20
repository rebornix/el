# Spec: Folder Picker

## Goal

Let users select a working directory when creating a session.

## Scope

- Show current path and entries
- Navigate up/down entries
- Open directories
- Confirm selected directory

## Keys

- `↑/↓`: move selection
- `Enter`: open selected directory
- `Tab`: choose current directory
- `Esc`: cancel/back

## Expected behavior

- Shows loading and error states
- Handles empty folders gracefully
- Returns selected directory URI to session-creation flow
