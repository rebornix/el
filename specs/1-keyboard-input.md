# Spec: Keyboard Input

## Goal

Provide predictable keyboard behavior for a terminal chat workflow.

## Scope

- Navigation in lists (`↑/↓`, optional `j/k`)
- Message input in session view
- Tool confirmation keys (`y`/`n`)
- Escape/back behavior
- Quit behavior (`Ctrl+C` twice)

## Behavior

### List views
- `↑/↓` changes selected row
- `Enter` activates selected row
- `Esc` returns to previous screen

### Session input
- Character keys insert text
- `Backspace` deletes previous character
- `Enter` sends current input
- `Esc` returns to session list

### Tool confirmation
When a confirmation prompt is active:
- `y` approves
- `n` denies

### Quit
- First `Ctrl+C`: show quit hint
- Second `Ctrl+C` shortly after: exit app

## Non-goals

- Advanced editor features beyond basic text entry
- Mouse-driven input behavior
