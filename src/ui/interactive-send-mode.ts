export function shouldDispatchInteractiveTurns(env = process.env): boolean {
  const v = env.EL_PI_TUI_DISPATCH?.trim().toLowerCase();
  if (!v) return true;
  return v === '1' || v === 'true' || v === 'yes';
}
