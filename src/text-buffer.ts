/** Mutable text buffer with cursor position for TUI input. */
export class TextBuffer {
  private _text = '';
  private _cursor = 0;

  get text(): string { return this._text; }
  get cursor(): number { return this._cursor; }
  set cursor(pos: number) { this._cursor = Math.max(0, Math.min(pos, this._text.length)); }

  get beforeCursor(): string { return this._text.slice(0, this._cursor); }
  get afterCursor(): string { return this._text.slice(this._cursor); }

  insert(str: string): void {
    this._text = this.beforeCursor + str + this.afterCursor;
    this._cursor += str.length;
  }

  deleteBackward(): void {
    if (this._cursor === 0) return;
    this._text = this._text.slice(0, this._cursor - 1) + this.afterCursor;
    this._cursor--;
  }

  deleteForward(): void {
    if (this._cursor >= this._text.length) return;
    this._text = this.beforeCursor + this._text.slice(this._cursor + 1);
  }

  moveLeft(): void { this.cursor--; }
  moveRight(): void { this.cursor++; }
  moveToStart(): void { this._cursor = 0; }
  moveToEnd(): void { this._cursor = this._text.length; }

  clear(): void {
    this._text = '';
    this._cursor = 0;
  }

  // Word boundary: splits on spaces
  deleteWordBackward(): void {
    if (this._cursor === 0) return;
    let pos = this._cursor;
    // Skip spaces
    while (pos > 0 && this._text[pos - 1] === ' ') pos--;
    // Skip word chars
    while (pos > 0 && this._text[pos - 1] !== ' ') pos--;
    this._text = this._text.slice(0, pos) + this.afterCursor;
    this._cursor = pos;
  }

  deleteWordForward(): void {
    if (this._cursor >= this._text.length) return;
    let pos = this._cursor;
    // Skip spaces first
    while (pos < this._text.length && this._text[pos] === ' ') pos++;
    // Skip word chars
    while (pos < this._text.length && this._text[pos] !== ' ') pos++;
    this._text = this.beforeCursor + this._text.slice(pos);
  }

  moveWordLeft(): void {
    if (this._cursor === 0) return;
    let pos = this._cursor;
    // Skip spaces
    while (pos > 0 && this._text[pos - 1] === ' ') pos--;
    // Skip word chars
    while (pos > 0 && this._text[pos - 1] !== ' ') pos--;
    this._cursor = pos;
  }

  moveWordRight(): void {
    if (this._cursor >= this._text.length) return;
    let pos = this._cursor;
    // Skip non-word chars (spaces/punctuation)
    while (pos < this._text.length && this._text[pos] === ' ') pos++;
    // Skip word chars
    while (pos < this._text.length && this._text[pos] !== ' ') pos++;
    this._cursor = pos;
  }

  killToEnd(): void {
    if (this._cursor >= this._text.length) return;
    this._text = this.beforeCursor;
  }

  killToStart(): void {
    if (this._cursor === 0) return;
    this._text = this.afterCursor;
    this._cursor = 0;
  }
}
