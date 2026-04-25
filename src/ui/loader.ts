/**
 * Loader animation state tracker.
 * 
 * This tracks animation frame state and renders the current frame as text.
 * It does NOT write to stdout directly. The containing orchestrator is responsible
 * for including the loader text in screen rendering.
 * 
 * Three styles:
 * - spinner: Braille character animation (default)
 * - gradient: Scrolling color shimmer
 * - minimal: Trailing dots
 */

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const GRADIENT_COLORS = [
  '\x1b[38;5;240m',
  '\x1b[38;5;245m',
  '\x1b[38;5;250m',
  '\x1b[38;5;255m',
  '\x1b[38;5;250m',
  '\x1b[38;5;245m',
];

export type LoaderStyle = 'spinner' | 'gradient' | 'minimal';

export interface LoaderConfig {
  style: LoaderStyle;
  text: string;
  onFrame?: () => void;
}

export class Loader {
  private config: LoaderConfig;
  private frame = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(config: LoaderConfig) {
    this.config = config;
  }

  start(): void {
    this.frame = 0;
    const ms = this.config.style === 'gradient' ? 150 : this.config.style === 'spinner' ? 80 : 300;
    this.interval = setInterval(() => {
      this.frame++;
      this.config.onFrame?.();
    }, ms);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getFrameIndex(): number {
    return this.frame;
  }

  getFrame(): string {
    const { text, style } = this.config;

    switch (style) {
      case 'minimal': {
        const dots = ['·', '··', '···'];
        return `${DIM}${text}${dots[this.frame % 3]}${RESET}`;
      }
      case 'spinner': {
        const char = SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length];
        return `${char} ${text}${RESET}`;
      }
      case 'gradient': {
        const len = GRADIENT_COLORS.length;
        let out = '';
        for (let i = 0; i < text.length; i++) {
          const ci = (this.frame + i) % len;
          out += GRADIENT_COLORS[ci] + text[i];
        }
        out += RESET;
        return out;
      }
    }
  }
}
