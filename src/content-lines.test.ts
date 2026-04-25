import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  wrapText,
  renderTurnToLines,
  renderAllTurns,
  computeViewport,
} from './content-lines.js';
import type { ITurn, IResponsePart, IMarkdownResponsePart, IToolCallResponsePart } from './protocol/types/index.js';
import {
  TurnState,
  ResponsePartKind,
  ToolCallStatus,
  ToolCallConfirmationReason,
} from './protocol/types/index.js';

// ─── Mock data ───────────────────────────────────────────────────────────────

function makeTurn(userText: string, responseParts: IResponsePart[] = [], id = 'turn-1'): ITurn {
  return {
    id,
    userMessage: { text: userText },
    responseParts,
    state: TurnState.Complete,
    usage: { inputTokens: 0, outputTokens: 0 },
  };
}

function markdownPart(content: string): IMarkdownResponsePart {
  return { kind: ResponsePartKind.Markdown, id: 'md-1', content };
}

function toolCallPart(displayName: string, status: ToolCallStatus = ToolCallStatus.Completed, invocationMessage?: string): IToolCallResponsePart {
  return {
    kind: ResponsePartKind.ToolCall,
    toolCall: {
      toolCallId: 'tc-1',
      toolName: 'test-tool',
      displayName,
      status,
      invocationMessage,
      confirmed: ToolCallConfirmationReason.UserAction,
    },
  } as IToolCallResponsePart;
}

// ─── wrapText ────────────────────────────────────────────────────────────────

describe('wrapText', () => {
  it('passes short text through', () => {
    assert.deepStrictEqual(wrapText('hello', 80), ['hello']);
  });

  it('wraps long line', () => {
    assert.deepStrictEqual(wrapText('abcdefghij', 5), ['abcde', 'fghij']);
  });

  it('handles newlines', () => {
    assert.deepStrictEqual(wrapText('a\nb\nc', 80), ['a', 'b', 'c']);
  });

  it('handles empty lines in text', () => {
    assert.deepStrictEqual(wrapText('a\n\nb', 80), ['a', '', 'b']);
  });

  it('wraps each segment of multiline text independently', () => {
    const result = wrapText('abcde\nfghij', 3);
    assert.deepStrictEqual(result, ['abc', 'de', 'fgh', 'ij']);
  });

  it('handles empty string', () => {
    assert.deepStrictEqual(wrapText('', 80), ['']);
  });
});

// ─── renderTurnToLines ───────────────────────────────────────────────────────

describe('renderTurnToLines', () => {
  it('renders simple turn with user message', () => {
    const turn = makeTurn('Hello world');
    const lines = renderTurnToLines(turn, 80);

    assert.ok(lines.length >= 3, `expected >=3 lines, got ${lines.length}`);
    assert.strictEqual(lines[0].kind, 'user-label');
    assert.ok(lines[0].text.includes('You'));
    assert.strictEqual(lines[1].kind, 'user-text');
    assert.ok(lines[1].text.includes('Hello world'));
    // Last line should be a gap
    assert.strictEqual(lines[lines.length - 1].kind, 'gap');
  });

  it('wraps long user messages', () => {
    const longText = 'a'.repeat(200);
    const turn = makeTurn(longText);
    const lines = renderTurnToLines(turn, 80);

    const userLines = lines.filter(l => l.kind === 'user-text');
    // 200 chars at contentWidth = 80 - 6 = 74 → 3 lines
    assert.ok(userLines.length >= 3, `expected >=3 user-text lines, got ${userLines.length}`);
  });

  it('renders markdown response', () => {
    const turn = makeTurn('hi', [markdownPart('This is a response.\nWith two lines.')]);
    const lines = renderTurnToLines(turn, 80);

    const mdLines = lines.filter(l => l.kind === 'markdown');
    assert.strictEqual(mdLines.length, 2);
    assert.ok(mdLines[0].text.includes('This is a response.'));
    assert.ok(mdLines[1].text.includes('With two lines.'));
  });

  it('renders tool call', () => {
    const turn = makeTurn('do it', [toolCallPart('ReadFile', ToolCallStatus.Completed, 'Read src/main.ts')]);
    const lines = renderTurnToLines(turn, 80);

    const toolLines = lines.filter(l => l.kind === 'tool-status');
    assert.strictEqual(toolLines.length, 1);
    assert.ok(toolLines[0].text.includes('✓'));
    assert.ok(toolLines[0].text.includes('ReadFile'));
    assert.ok(toolLines[0].text.includes('Read src/main.ts'));
    // Single tool call keeps │ connector
    assert.ok(toolLines[0].text.includes('│'));
  });

  it('uses tree connectors for consecutive tool calls', () => {
    const turn = makeTurn('do it', [
      toolCallPart('ReadFile', ToolCallStatus.Completed, 'Read a'),
      toolCallPart('ReadFile', ToolCallStatus.Completed, 'Read b'),
      toolCallPart('EditFile', ToolCallStatus.Running, 'Edit c'),
    ]);
    const lines = renderTurnToLines(turn, 80);

    const toolLines = lines.filter(l => l.kind === 'tool-status');
    assert.strictEqual(toolLines.length, 3);
    assert.ok(toolLines[0].text.includes('├'), 'first in group should use ├');
    assert.ok(toolLines[1].text.includes('├'), 'middle in group should use ├');
    assert.ok(toolLines[2].text.includes('└'), 'last in group should use └');
  });

  it('indents tool results under grouped calls', () => {
    const partWithResult = {
      kind: ResponsePartKind.ToolCall,
      toolCall: {
        toolCallId: 'tc-1', toolName: 'test', displayName: 'ReadFile',
        status: ToolCallStatus.Completed, invocationMessage: 'Read a',
        confirmed: ToolCallConfirmationReason.UserAction,
        content: [{ type: 'text', text: 'file contents here' }],
      },
    } as IToolCallResponsePart;
    const turn = makeTurn('do it', [
      partWithResult,
      toolCallPart('EditFile', ToolCallStatus.Completed, 'Edit b'),
    ]);
    const lines = renderTurnToLines(turn, 80);

    const resultLines = lines.filter(l => l.kind === 'tool-result');
    assert.ok(resultLines.length > 0, 'should have result lines');
    assert.ok(resultLines[0].text.startsWith('      '), 'result lines use plain indentation');
  });

  it('strips markdown links from invocation messages', () => {
    const turn = makeTurn('do it', [
      toolCallPart('View File', ToolCallStatus.Completed, 'Reading [auth.ts](file:///path/to/auth.ts)'),
    ]);
    const lines = renderTurnToLines(turn, 80);

    const toolLine = lines.find(l => l.kind === 'tool-status')!;
    assert.ok(toolLine.text.includes('auth.ts'), 'should include file name');
    assert.ok(!toolLine.text.includes(']('), 'should not contain markdown link syntax');
  });

  it('renders turn error state', () => {
    const turn = makeTurn('oops');
    turn.state = TurnState.Error;
    turn.error = { errorType: 'test', message: 'Something broke' };
    const lines = renderTurnToLines(turn, 80);

    const errorLines = lines.filter(l => l.kind === 'turn-error');
    assert.strictEqual(errorLines.length, 1);
    assert.ok(errorLines[0].text.includes('Something broke'));
  });

  it('renders cancelled turn', () => {
    const turn = makeTurn('nope');
    turn.state = TurnState.Cancelled;
    const lines = renderTurnToLines(turn, 80);

    const cancelLines = lines.filter(l => l.kind === 'turn-cancel');
    assert.strictEqual(cancelLines.length, 1);
  });

  it('handles multiline user message with wrapping', () => {
    const text = 'Line one\nLine two which is quite long and should wrap at narrow widths';
    const turn = makeTurn(text);
    const lines = renderTurnToLines(turn, 40);

    const userLines = lines.filter(l => l.kind === 'user-text');
    // "Line two which is quite long and should wrap at narrow widths" = 62 chars
    // contentWidth = 40 - 6 = 34 → wraps to 2 lines
    assert.ok(userLines.length >= 3, `expected >=3 user lines, got ${userLines.length}`);
  });
});

// ─── renderAllTurns ──────────────────────────────────────────────────────────

describe('renderAllTurns', () => {
  it('concatenates turns correctly', () => {
    const turns = [
      makeTurn('First', [markdownPart('Response 1')], 'turn-1'),
      makeTurn('Second', [markdownPart('Response 2')], 'turn-2'),
    ];
    const { lines, turnLineCounts, turnStartLines } = renderAllTurns(turns, 80);

    assert.strictEqual(turnLineCounts.length, 2);
    assert.strictEqual(turnStartLines.length, 2);
    assert.strictEqual(turnStartLines[0], 0);
    assert.strictEqual(turnStartLines[1], turnLineCounts[0]);
    assert.strictEqual(lines.length, turnLineCounts[0] + turnLineCounts[1]);
  });

  it('handles empty turns array', () => {
    const { lines, turnLineCounts, turnStartLines } = renderAllTurns([], 80);
    assert.strictEqual(lines.length, 0);
    assert.strictEqual(turnLineCounts.length, 0);
    assert.strictEqual(turnStartLines.length, 0);
  });
});

// ─── computeViewport ────────────────────────────────────────────────────────

describe('computeViewport', () => {
  // Helper to create test data
  function makeTestData(lineCounts: number[]) {
    const turnStartLines: number[] = [];
    let acc = 0;
    for (const c of lineCounts) {
      turnStartLines.push(acc);
      acc += c;
    }
    return { totalLines: acc, turnStartLines, turnLineCounts: lineCounts };
  }

  it('at bottom (offset=0), shows last lines', () => {
    const d = makeTestData([30, 80, 50]); // 160 total
    const vp = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, 0, 40);

    assert.strictEqual(vp.endLine, 160);
    assert.strictEqual(vp.startLine, 120);
    assert.strictEqual(vp.hasBelow, false);
    assert.strictEqual(vp.hasAbove, true);
    assert.strictEqual(vp.scrollPercent, 100);
  });

  it('at top (offset=maxScroll), shows first lines', () => {
    const d = makeTestData([30, 80, 50]); // 160 total, maxScroll = 120
    const vp = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, 120, 40);

    assert.strictEqual(vp.startLine, 0);
    assert.strictEqual(vp.endLine, 40);
    assert.strictEqual(vp.hasAbove, false);
    assert.strictEqual(vp.hasBelow, true);
    assert.strictEqual(vp.scrollPercent, 0);
  });

  it('middle position', () => {
    const d = makeTestData([30, 80, 50]); // 160 total
    const vp = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, 60, 40);

    assert.strictEqual(vp.endLine, 100); // 160 - 60
    assert.strictEqual(vp.startLine, 60); // 100 - 40
    assert.strictEqual(vp.hasAbove, true);
    assert.strictEqual(vp.hasBelow, true);
  });

  it('clamps over-scroll to maxScroll', () => {
    const d = makeTestData([30, 80, 50]); // maxScroll = 120
    const vp = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, 999, 40);

    assert.strictEqual(vp.startLine, 0);
    assert.strictEqual(vp.endLine, 40);
  });

  it('clamps negative scroll to 0', () => {
    const d = makeTestData([30, 80, 50]);
    const vp = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, -10, 40);

    assert.strictEqual(vp.endLine, 160);
    assert.strictEqual(vp.startLine, 120);
  });

  it('content fits in viewport (no scrolling needed)', () => {
    const d = makeTestData([10, 10]); // 20 total, viewport = 40
    const vp = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, 0, 40);

    assert.strictEqual(vp.startLine, 0);
    assert.strictEqual(vp.endLine, 20);
    assert.strictEqual(vp.maxScroll, 0);
    assert.strictEqual(vp.hasAbove, false);
    assert.strictEqual(vp.hasBelow, false);
    assert.strictEqual(vp.scrollPercent, 100);
  });

  it('identifies correct turn indices at viewport boundary', () => {
    const d = makeTestData([10, 20, 30, 40]); // starts: 0, 10, 30, 60. total = 100
    // Viewport at bottom: lines 60-99 → turn 3 only (turn 2 ends at line 59, not in viewport)
    const vpBot = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, 0, 40);
    assert.strictEqual(vpBot.firstTurnIdx, 3);
    assert.strictEqual(vpBot.lastTurnIdx, 3);

    // Viewport at top: lines 0-39 → turns 0, 1, 2
    const vpTop = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, 60, 40);
    assert.strictEqual(vpTop.firstTurnIdx, 0);
    assert.strictEqual(vpTop.lastTurnIdx, 2); // turn 2 starts at 30, extends past 39
  });

  it('every line reachable with step=1', () => {
    const d = makeTestData([29, 86, 129, 49, 23, 56]); // Karpathy-like
    const availableLines = 40;
    const lineVisible = new Array(d.totalLines).fill(false);

    for (let offset = 0; offset <= d.totalLines; offset++) {
      const vp = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, offset, availableLines);
      for (let i = vp.startLine; i < vp.endLine; i++) {
        if (i >= 0 && i < d.totalLines) lineVisible[i] = true;
      }
    }

    const invisible = lineVisible.filter(v => !v).length;
    assert.strictEqual(invisible, 0, `${invisible} lines not reachable`);
  });

  it('every line reachable with step=3', () => {
    const d = makeTestData([29, 86, 129, 49, 23, 56]); // Karpathy-like
    const availableLines = 40;
    const maxScroll = d.totalLines - availableLines;
    const lineVisible = new Array(d.totalLines).fill(false);

    for (let offset = 0; offset <= maxScroll; offset += 3) {
      const vp = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, offset, availableLines);
      for (let i = vp.startLine; i < vp.endLine; i++) {
        if (i >= 0 && i < d.totalLines) lineVisible[i] = true;
      }
    }
    // Also check at maxScroll exactly
    const vpMax = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, maxScroll, availableLines);
    for (let i = vpMax.startLine; i < vpMax.endLine; i++) {
      if (i >= 0 && i < d.totalLines) lineVisible[i] = true;
    }

    const invisible = lineVisible.filter(v => !v).length;
    assert.strictEqual(invisible, 0, `${invisible} lines not reachable with step=3`);
  });

  it('single very tall turn scrolls properly', () => {
    const d = makeTestData([200]); // One turn, 200 lines
    const availableLines = 30;
    const maxScroll = 170;

    // Bottom
    const vpBot = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, 0, availableLines);
    assert.strictEqual(vpBot.startLine, 170);
    assert.strictEqual(vpBot.endLine, 200);

    // Top
    const vpTop = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, maxScroll, availableLines);
    assert.strictEqual(vpTop.startLine, 0);
    assert.strictEqual(vpTop.endLine, 30);

    // Mid
    const vpMid = computeViewport(d.totalLines, d.turnStartLines, d.turnLineCounts, 85, availableLines);
    assert.strictEqual(vpMid.startLine, 85);
    assert.strictEqual(vpMid.endLine, 115);
  });
});
