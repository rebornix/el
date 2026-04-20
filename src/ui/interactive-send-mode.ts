export function shouldDispatchInteractiveTurns(env = process.env): boolean {
  const v = env.EL_PI_TUI_DISPATCH?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
