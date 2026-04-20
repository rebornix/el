import { TextBuffer } from '../text-buffer.js';

export interface SessionInputKey {
  escape?: boolean;
  return?: boolean;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  tab?: boolean;
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  backspace?: boolean;
  delete?: boolean;
}

type SessionKeyAction =
  | { type: 'back' }
  | { type: 'send'; text: string }
  | { type: 'tool-confirm'; approved: boolean }
  | { type: 'scroll'; offset: number }
  | { type: 'input-changed' }
  | { type: 'noop' };

export function handleSessionKey(params: {
  input: string;
  key: SessionInputKey;
  buf: TextBuffer;
  pendingToolCall: boolean;
  scrollLineOffset: number;
  maxScroll: number;
  availableLines: number;
}): SessionKeyAction {
  const { input, key, buf, pendingToolCall, scrollLineOffset, maxScroll, availableLines } = params;

  if (key.escape) return { type: 'back' };

  if (pendingToolCall) {
    if (input === 'y' || input === 'Y') return { type: 'tool-confirm', approved: true };
    if (input === 'n' || input === 'N') return { type: 'tool-confirm', approved: false };
    return { type: 'noop' };
  }

  if (key.return && !key.shift && buf.text.trim()) {
    const text = buf.text.trim();
    buf.clear();
    return { type: 'send', text };
  }

  if (key.return && key.shift) {
    buf.insert('\n');
    return { type: 'input-changed' };
  }

  if (key.ctrl && input === 'k') { buf.killToEnd(); return { type: 'input-changed' }; }
  if (key.ctrl && input === 'u') { buf.killToStart(); return { type: 'input-changed' }; }
  if (key.ctrl && input === 'w') { buf.deleteWordBackward(); return { type: 'input-changed' }; }
  if (key.meta && key.backspace) { buf.deleteWordBackward(); return { type: 'input-changed' }; }
  if (key.meta && input === 'd') { buf.deleteWordForward(); return { type: 'input-changed' }; }
  if (key.ctrl && input === 'd' && buf.text.length > 0) { buf.deleteForward(); return { type: 'input-changed' }; }
  if (key.backspace || key.delete) { buf.deleteBackward(); return { type: 'input-changed' }; }

  if (key.ctrl && input === 'b') { buf.moveLeft(); return { type: 'input-changed' }; }
  if (key.ctrl && input === 'f') { buf.moveRight(); return { type: 'input-changed' }; }
  if (key.leftArrow && !key.meta) { buf.moveLeft(); return { type: 'input-changed' }; }
  if (key.rightArrow && !key.meta) { buf.moveRight(); return { type: 'input-changed' }; }

  if (key.meta && input === 'b') { buf.moveWordLeft(); return { type: 'input-changed' }; }
  if (key.meta && input === 'f') { buf.moveWordRight(); return { type: 'input-changed' }; }

  if (key.ctrl && input === 'a') { buf.moveToStart(); return { type: 'input-changed' }; }
  if (key.ctrl && input === 'e') { buf.moveToEnd(); return { type: 'input-changed' }; }

  const SCROLL_LINES = 3;
  if (key.upArrow) return { type: 'scroll', offset: Math.min(scrollLineOffset + SCROLL_LINES, maxScroll) };
  if (key.downArrow) return { type: 'scroll', offset: Math.max(0, scrollLineOffset - SCROLL_LINES) };

  const PAGE_LINES = Math.max(5, Math.floor(availableLines / 2));
  if (key.meta && input === 'u') return { type: 'scroll', offset: Math.min(scrollLineOffset + PAGE_LINES, maxScroll) };
  if (key.meta && input === 'n') return { type: 'scroll', offset: Math.max(0, scrollLineOffset - PAGE_LINES) };

  if (input === 'g' && !key.ctrl && !key.meta && buf.text.length === 0) return { type: 'scroll', offset: 0 };
  if (input === 'G' && !key.ctrl && !key.meta && buf.text.length === 0) return { type: 'scroll', offset: maxScroll };

  if (input && !key.ctrl && !key.meta && !key.tab) {
    buf.insert(input);
    return { type: 'input-changed' };
  }

  return { type: 'noop' };
}
