import { renderPiTuiPreview } from './pi-tui-preview.js';

export function shouldRunPiTuiPreview(env = process.env): boolean {
  const v = env.EL_PI_TUI_PREVIEW?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function printPiTuiPreviewAndExit(): never {
  const text = renderPiTuiPreview({ sessionState: null });
  process.stdout.write(text + '\n');
  process.exit(0);
}
