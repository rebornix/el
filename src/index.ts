#!/usr/bin/env node

import { shouldRunPiTuiPreview, printPiTuiPreviewAndExit } from './ui/preview-mode.js';
import { runPiTuiInteractiveScaffold } from './ui/pi-tui-interactive.js';
import { resolveStartupServer } from './ui/startup-target.js';

function parseArgs(): {
  server?: string;
  tunnel?: string;
  tunnelToken?: string;
  tunnelAuth?: 'github' | 'microsoft';
} {
  const args = process.argv.slice(2);
  const result: {
    server?: string;
    tunnel?: string;
    tunnelToken?: string;
    tunnelAuth?: 'github' | 'microsoft';
  } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--server' && args[i + 1]) {
      result.server = args[++i];
      continue;
    }
    if (args[i] === '--tunnel' && args[i + 1]) {
      result.tunnel = args[++i];
      continue;
    }
    if (args[i] === '--tunnel-token' && args[i + 1]) {
      result.tunnelToken = args[++i];
      continue;
    }
    if (args[i] === '--tunnel-auth' && args[i + 1]) {
      const auth = args[++i];
      if (auth === 'github' || auth === 'microsoft') {
        result.tunnelAuth = auth;
      }
    }
  }
  return result;
}

const ALT_SCREEN_ENTER = '\x1b[?1049h';
const ALT_SCREEN_EXIT = '\x1b[?1049l';
const CURSOR_HIDE = '\x1b[?25l';
const CURSOR_SHOW = '\x1b[?25h';

function enterAltScreen(): void {
  process.stdout.write(ALT_SCREEN_ENTER + CURSOR_HIDE);
}

function exitAltScreen(): void {
  process.stdout.write(CURSOR_SHOW + ALT_SCREEN_EXIT);
}

function installExitTrap(): void {
  let exited = false;
  const cleanup = () => {
    if (exited) return;
    exited = true;
    exitAltScreen();
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
  process.on('uncaughtException', (err) => {
    cleanup();
    console.error(err);
    process.exit(1);
  });
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\.tsx?$/, '.js'));
if (isMain) {
  const { server, tunnel, tunnelToken, tunnelAuth } = parseArgs();

  if (shouldRunPiTuiPreview(process.env)) {
    printPiTuiPreviewAndExit();
  }

  enterAltScreen();
  installExitTrap();

  const serverTarget = server ?? (tunnel ? `tunnel://${tunnel}` : undefined);

  resolveStartupServer(serverTarget, {
    tunnelToken,
    tunnelAuth,
  })
    .then((target) => runPiTuiInteractiveScaffold({
      serverUrl: target,
      tunnelToken,
      tunnelAuth,
    }))
    .then(() => exitAltScreen())
    .catch((err) => {
      exitAltScreen();
      console.error(err);
      process.exit(1);
    });
}
