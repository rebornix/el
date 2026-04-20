export type ServerPromptMode = 'menu' | 'url-input';

interface MenuOption {
  label: string;
  value: string;
}

export const MENU_OPTIONS: MenuOption[] = [
  { label: '🌐  Connect via Dev Tunnel', value: 'tunnel://' },
  { label: '🔌  Connect to local server', value: 'local' },
];

export function validateServerUrl(url: string): string | undefined {
  const v = url.trim();
  if (!v) return 'URL is required';
  if (!v.startsWith('ws://') && !v.startsWith('wss://')) {
    return 'URL must start with ws:// or wss://';
  }
  return undefined;
}

export function nextMenuIndex(current: number, dir: 'up' | 'down'): number {
  if (dir === 'up') return Math.max(0, current - 1);
  return Math.min(MENU_OPTIONS.length - 1, current + 1);
}
