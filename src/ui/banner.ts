const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';

const LOGO = [
  '███████╗██╗',
  '██╔════╝██║',
  '█████╗  ██║',
  '██╔══╝  ██║',
  '███████╗███████╗',
  '╚══════╝╚══════╝',
];

const LOGO_WIDTH = 16;

export function bannerLines(cols: number): string[] {
  const pad = Math.max(0, Math.floor((cols - LOGO_WIDTH) / 2));
  const prefix = ' '.repeat(pad);
  return ['', ...LOGO.map(line => `${CYAN}${BOLD}${prefix}${line}${RESET}`)];
}

export const BANNER_LINE_COUNT = LOGO.length + 1;
