export interface KeypressLike {
  sequence?: string;
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

export function mapKeypressToPiEvent(str: string, key: KeypressLike) {
  return {
    input: str,
    key: {
      escape: key.name === 'escape',
      return: key.name === 'return' || str === '\r' || str === '\n',
      shift: !!key.shift,
      ctrl: !!key.ctrl,
      meta: !!key.meta,
      tab: key.name === 'tab' || str === '\t',
      upArrow: key.name === 'up',
      downArrow: key.name === 'down',
      leftArrow: key.name === 'left',
      rightArrow: key.name === 'right',
      backspace: key.name === 'backspace',
      delete: key.name === 'delete',
    },
  };
}
