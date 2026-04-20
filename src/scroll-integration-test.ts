/**
 * scroll-integration-test.ts — Live scroll verification against a real AHP server.
 *
 * Usage: node dist/scroll-integration-test.js [ws://localhost:8081] [cols] [rows]
 *
 * Connects to the server, picks the largest session (or one matching --session),
 * renders all turns to content lines, and verifies that every line is reachable
 * via scrolling.
 */

import { WebSocketTransport } from './protocol/transport.js';
import { AhpClient } from './protocol/client.js';
import { SessionClientState } from './protocol/session-client-state.js';
import { renderAllTurns, computeViewport } from './content-lines.js';
import type { ISessionState } from './protocol/types/index.js';

const CHROME_OVERHEAD = 10;

async function getSession(serverUrl: string, sessionHint?: string): Promise<{
  state: ISessionState;
  title: string;
}> {
  const transport = new WebSocketTransport();
  const client = new AhpClient(transport);
  const sm = new SessionClientState();

  await transport.connect(serverUrl);
  const init = await client.initialize('el-scroll-test-' + Date.now(), ['agenthost:/root']);
  for (const s of init.snapshots) sm.handleSnapshot(s);

  const list = await client.listSessions();
  if (list.items.length === 0) {
    throw new Error('No sessions found on server');
  }

  // Pick session: match hint, or pick the one with most data
  let target = sessionHint
    ? list.items.find(x => x.title?.toLowerCase().includes(sessionHint.toLowerCase()))
    : undefined;

  if (!target) {
    // Subscribe to all and pick the one with most turns
    let bestCount = 0;
    for (const item of list.items.slice(0, 10)) {
      try {
        const sub = await client.subscribe(item.resource);
        sm.handleSnapshot(sub.snapshot);
        const s = sm.getSessionState(item.resource);
        if (s && s.turns.length > bestCount) {
          bestCount = s.turns.length;
          target = item;
        }
      } catch { /* skip */ }
    }
  }

  if (!target) throw new Error('No suitable session found');

  const sub = await client.subscribe(target.resource);
  sm.handleSnapshot(sub.snapshot);
  const state = sm.getSessionState(target.resource);
  if (!state) throw new Error('Failed to get session state');

  transport.disconnect();
  return { state, title: target.title || '(untitled)' };
}

function runScrollVerification(state: ISessionState, termCols: number, termRows: number): boolean {
  const availableLines = Math.max(10, termRows - CHROME_OVERHEAD);

  console.log(`\n═══ Scroll Verification ═══`);
  console.log(`Session: "${state.summary.title || '(untitled)'}"`);
  console.log(`Turns: ${state.turns.length}`);
  console.log(`Terminal: ${termCols}×${termRows} (viewport: ${availableLines} lines)`);

  // Render all turns
  const { lines, turnLineCounts, turnStartLines } = renderAllTurns(state.turns, termCols);
  const totalLines = lines.length;
  const maxScroll = Math.max(0, totalLines - availableLines);

  console.log(`Total lines: ${totalLines}`);
  console.log(`Max scroll offset: ${maxScroll}`);
  console.log(`Turn line counts: [${turnLineCounts.join(', ')}]`);
  console.log(`Turn start lines: [${turnStartLines.join(', ')}]`);

  let errors = 0;

  // ── Check 1: Every line is visible at some scroll position ──
  console.log(`\n── Check 1: Line coverage ──`);
  const lineVisible = new Array(totalLines).fill(false);

  for (let offset = 0; offset <= maxScroll; offset++) {
    const vp = computeViewport(totalLines, turnStartLines, turnLineCounts, offset, availableLines);

    if (vp.startLine < 0) {
      console.error(`  FAIL: offset=${offset} → startLine=${vp.startLine} (negative)`);
      errors++;
    }
    if (vp.endLine > totalLines) {
      console.error(`  FAIL: offset=${offset} → endLine=${vp.endLine} > totalLines=${totalLines}`);
      errors++;
    }
    if (vp.endLine - vp.startLine > availableLines) {
      console.error(`  FAIL: offset=${offset} → viewport ${vp.endLine - vp.startLine} > available ${availableLines}`);
      errors++;
    }

    for (let i = vp.startLine; i < vp.endLine; i++) {
      if (i >= 0 && i < totalLines) lineVisible[i] = true;
    }
  }

  const invisibleCount = lineVisible.filter(v => !v).length;
  if (invisibleCount > 0) {
    const firstInvisible = lineVisible.indexOf(false);
    console.error(`  FAIL: ${invisibleCount} lines never visible. First invisible: line ${firstInvisible}`);
    console.error(`  Content: "${lines[firstInvisible]?.text.slice(0, 60)}"`);
    errors++;
  } else {
    console.log(`  ✓ All ${totalLines} lines reachable across ${maxScroll + 1} scroll positions`);
  }

  // ── Check 2: Bottom position shows last lines ──
  console.log(`\n── Check 2: Bottom position (offset=0) ──`);
  const vpBottom = computeViewport(totalLines, turnStartLines, turnLineCounts, 0, availableLines);
  if (vpBottom.endLine !== totalLines) {
    console.error(`  FAIL: endLine=${vpBottom.endLine}, expected ${totalLines}`);
    errors++;
  } else {
    console.log(`  ✓ endLine=${vpBottom.endLine} (correct)`);
  }
  if (vpBottom.hasBelow) {
    console.error(`  FAIL: hasBelow should be false at bottom`);
    errors++;
  } else {
    console.log(`  ✓ hasBelow=false (correct)`);
  }
  console.log(`  Visible: lines ${vpBottom.startLine}–${vpBottom.endLine - 1}, turns ${vpBottom.firstTurnIdx}–${vpBottom.lastTurnIdx}`);

  // ── Check 3: Top position shows first lines ──
  console.log(`\n── Check 3: Top position (offset=maxScroll=${maxScroll}) ──`);
  const vpTop = computeViewport(totalLines, turnStartLines, turnLineCounts, maxScroll, availableLines);
  if (vpTop.startLine !== 0) {
    console.error(`  FAIL: startLine=${vpTop.startLine}, expected 0`);
    errors++;
  } else {
    console.log(`  ✓ startLine=0 (correct)`);
  }
  if (vpTop.hasAbove) {
    console.error(`  FAIL: hasAbove should be false at top`);
    errors++;
  } else {
    console.log(`  ✓ hasAbove=false (correct)`);
  }
  console.log(`  Visible: lines ${vpTop.startLine}–${vpTop.endLine - 1}, turns ${vpTop.firstTurnIdx}–${vpTop.lastTurnIdx}`);

  // ── Check 4: First and last lines content ──
  console.log(`\n── Content samples ──`);
  console.log(`First 5 lines:`);
  for (let i = 0; i < Math.min(5, totalLines); i++) {
    console.log(`  ${String(i).padStart(4)}: [${lines[i].kind.padEnd(12)}] ${lines[i].text.slice(0, 70)}`);
  }
  console.log(`Last 5 lines:`);
  for (let i = Math.max(0, totalLines - 5); i < totalLines; i++) {
    console.log(`  ${String(i).padStart(4)}: [${lines[i].kind.padEnd(12)}] ${lines[i].text.slice(0, 70)}`);
  }

  // ── Check 5: Scroll step simulation (mimics arrow key presses) ──
  console.log(`\n── Check 5: Scroll step simulation (3 lines per press) ──`);
  const SCROLL_LINES = 3;
  let offset = 0;
  let steps = 0;
  const visited = new Set<number>();

  // Scroll up from bottom to top
  while (offset <= maxScroll) {
    const vp = computeViewport(totalLines, turnStartLines, turnLineCounts, offset, availableLines);
    for (let i = vp.startLine; i < vp.endLine; i++) visited.add(i);
    offset += SCROLL_LINES;
    steps++;
  }
  // One more at max
  const vpFinal = computeViewport(totalLines, turnStartLines, turnLineCounts, maxScroll, availableLines);
  for (let i = vpFinal.startLine; i < vpFinal.endLine; i++) visited.add(i);
  steps++;

  const missedByStep = totalLines - visited.size;
  if (missedByStep > 0) {
    console.error(`  FAIL: ${missedByStep} lines missed with step=${SCROLL_LINES}`);
    // Find which lines
    for (let i = 0; i < totalLines; i++) {
      if (!visited.has(i)) {
        console.error(`    Line ${i}: [${lines[i].kind}] ${lines[i].text.slice(0, 60)}`);
        if (missedByStep > 5) { console.error(`    ... and ${missedByStep - 1} more`); break; }
      }
    }
    errors++;
  } else {
    console.log(`  ✓ All ${totalLines} lines visible in ${steps} arrow key presses`);
  }

  // ── Summary ──
  console.log(`\n═══ Result ═══`);
  if (errors === 0) {
    console.log(`✓ ALL CHECKS PASSED`);
    return true;
  } else {
    console.log(`✗ ${errors} FAILURE(S)`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const serverUrl = args.find(a => a.startsWith('ws://')) || 'ws://localhost:8081';
  const colsArg = args.find(a => /^\d+$/.test(a));
  const termCols = colsArg ? parseInt(colsArg) : process.stdout.columns || 120;
  const termRows = process.stdout.rows || 50;
  const sessionHint = args.find(a => !a.startsWith('ws://') && !/^\d+$/.test(a));

  console.log(`Connecting to ${serverUrl}...`);
  console.log(`Session filter: ${sessionHint || '(largest session)'}`);

  try {
    const { state } = await getSession(serverUrl, sessionHint);
    const ok = runScrollVerification(state, termCols, termRows);

    // Also test with smaller terminal sizes
    console.log(`\n\n═══ Small terminal test (80×24) ═══`);
    const ok2 = runScrollVerification(state, 80, 24);

    console.log(`\n\n═══ Tiny terminal test (60×15) ═══`);
    const ok3 = runScrollVerification(state, 60, 15);

    process.exit(ok && ok2 && ok3 ? 0 : 1);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
