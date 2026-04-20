import { MENU_OPTIONS, validateServerUrl, type ServerPromptMode } from './server-prompt-model.js';
import type { SessionInputKey } from './session-key-handler.js';

type ServerPromptKey = Pick<SessionInputKey, 'upArrow' | 'downArrow' | 'return' | 'escape' | 'ctrl' | 'meta' | 'leftArrow' | 'rightArrow' | 'backspace' | 'delete'>;

interface BufferLike {
  text: string;
  insert(s: string): void;
  deleteBackward(): void;
  moveLeft(): void;
  moveRight(): void;
  moveToStart(): void;
  moveToEnd(): void;
  killToStart(): void;
  killToEnd(): void;
  deleteWordBackward(): void;
}

type ServerPromptAction =
  | { type: 'mode'; mode: ServerPromptMode }
  | { type: 'select-index'; index: number }
  | { type: 'submit'; url: string }
  | { type: 'error'; message?: string }
  | { type: 'input-changed' }
  | { type: 'noop' };

export function handleServerPromptKey(params: {
  mode: ServerPromptMode;
  selectedIndex: number;
  input: string;
  key: ServerPromptKey;
  buf: BufferLike;
}): ServerPromptAction {
  const { mode, selectedIndex, input, key, buf } = params;

  if (mode === 'menu') {
    if (key.upArrow || (key.ctrl && input === 'p')) {
      return { type: 'select-index', index: Math.max(0, selectedIndex - 1) };
    }
    if (key.downArrow || (key.ctrl && input === 'n')) {
      return { type: 'select-index', index: Math.min(MENU_OPTIONS.length - 1, selectedIndex + 1) };
    }
    if (key.return) {
      const option = MENU_OPTIONS[selectedIndex];
      if (option?.value === 'local') return { type: 'mode', mode: 'url-input' };
      return { type: 'submit', url: option?.value ?? 'tunnel://' };
    }
    return { type: 'noop' };
  }

  // url-input mode
  if (key.escape) return { type: 'mode', mode: 'menu' };

  if (key.return) {
    const url = buf.text.trim();
    const err = validateServerUrl(url);
    if (err) return { type: 'error', message: err === 'URL is required' ? undefined : err };
    return { type: 'submit', url };
  }

  if (key.backspace || key.delete) {
    buf.deleteBackward();
    return { type: 'input-changed' };
  }
  if (key.leftArrow || (key.ctrl && input === 'b')) {
    buf.moveLeft();
    return { type: 'input-changed' };
  }
  if (key.rightArrow || (key.ctrl && input === 'f')) {
    buf.moveRight();
    return { type: 'input-changed' };
  }
  if (key.ctrl && input === 'a') {
    buf.moveToStart();
    return { type: 'input-changed' };
  }
  if (key.ctrl && input === 'e') {
    buf.moveToEnd();
    return { type: 'input-changed' };
  }
  if (key.ctrl && input === 'u') {
    buf.killToStart();
    return { type: 'input-changed' };
  }
  if (key.ctrl && input === 'k') {
    buf.killToEnd();
    return { type: 'input-changed' };
  }
  if (key.ctrl && input === 'w') {
    buf.deleteWordBackward();
    return { type: 'input-changed' };
  }
  if (input && !key.ctrl && !key.meta) {
    buf.insert(input);
    return { type: 'input-changed' };
  }

  return { type: 'noop' };
}
