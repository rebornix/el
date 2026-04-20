import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TextBuffer } from './text-buffer.js';

describe('TextBuffer', () => {
  it('starts empty with cursor at 0', () => {
    const buf = new TextBuffer();
    assert.equal(buf.text, '');
    assert.equal(buf.cursor, 0);
  });

  it('insert appends at cursor', () => {
    const buf = new TextBuffer();
    buf.insert('hello');
    assert.equal(buf.text, 'hello');
    assert.equal(buf.cursor, 5);
  });

  it('insert at middle of text', () => {
    const buf = new TextBuffer();
    buf.insert('hllo');
    buf.cursor = 1;
    buf.insert('e');
    assert.equal(buf.text, 'hello');
    assert.equal(buf.cursor, 2);
  });

  it('deleteBackward removes char before cursor', () => {
    const buf = new TextBuffer();
    buf.insert('abc');
    buf.deleteBackward();
    assert.equal(buf.text, 'ab');
    assert.equal(buf.cursor, 2);
  });

  it('deleteBackward at start is no-op', () => {
    const buf = new TextBuffer();
    buf.insert('abc');
    buf.cursor = 0;
    buf.deleteBackward();
    assert.equal(buf.text, 'abc');
    assert.equal(buf.cursor, 0);
  });

  it('deleteForward removes char at cursor', () => {
    const buf = new TextBuffer();
    buf.insert('abc');
    buf.cursor = 1;
    buf.deleteForward();
    assert.equal(buf.text, 'ac');
    assert.equal(buf.cursor, 1);
  });

  it('deleteForward at end is no-op', () => {
    const buf = new TextBuffer();
    buf.insert('abc');
    buf.deleteForward();
    assert.equal(buf.text, 'abc');
    assert.equal(buf.cursor, 3);
  });

  it('moveLeft decrements cursor', () => {
    const buf = new TextBuffer();
    buf.insert('abc');
    buf.moveLeft();
    assert.equal(buf.cursor, 2);
  });

  it('moveLeft at 0 stays at 0', () => {
    const buf = new TextBuffer();
    buf.moveLeft();
    assert.equal(buf.cursor, 0);
  });

  it('moveRight increments cursor', () => {
    const buf = new TextBuffer();
    buf.insert('abc');
    buf.cursor = 1;
    buf.moveRight();
    assert.equal(buf.cursor, 2);
  });

  it('moveRight at end stays at end', () => {
    const buf = new TextBuffer();
    buf.insert('abc');
    buf.moveRight();
    assert.equal(buf.cursor, 3);
  });

  it('moveToStart sets cursor to 0', () => {
    const buf = new TextBuffer();
    buf.insert('abc');
    buf.moveToStart();
    assert.equal(buf.cursor, 0);
  });

  it('moveToEnd sets cursor to text length', () => {
    const buf = new TextBuffer();
    buf.insert('abc');
    buf.cursor = 0;
    buf.moveToEnd();
    assert.equal(buf.cursor, 3);
  });

  it('clear resets text and cursor', () => {
    const buf = new TextBuffer();
    buf.insert('hello');
    buf.clear();
    assert.equal(buf.text, '');
    assert.equal(buf.cursor, 0);
  });

  it('deleteWordBackward removes previous word', () => {
    const buf = new TextBuffer();
    buf.insert('hello world');
    buf.deleteWordBackward();
    assert.equal(buf.text, 'hello ');
    assert.equal(buf.cursor, 6);
  });

  it('deleteWordBackward removes trailing spaces then word', () => {
    const buf = new TextBuffer();
    buf.insert('hello   ');
    buf.deleteWordBackward();
    assert.equal(buf.text, '');
    assert.equal(buf.cursor, 0);
  });

  it('deleteWordBackward at start is no-op', () => {
    const buf = new TextBuffer();
    buf.insert('hello');
    buf.cursor = 0;
    buf.deleteWordBackward();
    assert.equal(buf.text, 'hello');
    assert.equal(buf.cursor, 0);
  });

  it('deleteWordBackward from middle of word', () => {
    const buf = new TextBuffer();
    buf.insert('hello world');
    buf.cursor = 8; // "hello wo|rld"
    buf.deleteWordBackward();
    assert.equal(buf.text, 'hello rld');
    assert.equal(buf.cursor, 6);
  });

  it('killToEnd removes from cursor to end', () => {
    const buf = new TextBuffer();
    buf.insert('hello world');
    buf.cursor = 5;
    buf.killToEnd();
    assert.equal(buf.text, 'hello');
    assert.equal(buf.cursor, 5);
  });

  it('killToEnd at end is no-op', () => {
    const buf = new TextBuffer();
    buf.insert('abc');
    buf.killToEnd();
    assert.equal(buf.text, 'abc');
  });

  it('killToStart removes from start to cursor', () => {
    const buf = new TextBuffer();
    buf.insert('hello world');
    buf.cursor = 6;
    buf.killToStart();
    assert.equal(buf.text, 'world');
    assert.equal(buf.cursor, 0);
  });

  it('killToStart at start is no-op', () => {
    const buf = new TextBuffer();
    buf.insert('abc');
    buf.cursor = 0;
    buf.killToStart();
    assert.equal(buf.text, 'abc');
    assert.equal(buf.cursor, 0);
  });

  it('moveWordLeft jumps to start of previous word', () => {
    const buf = new TextBuffer();
    buf.insert('hello world');
    buf.moveWordLeft();
    assert.equal(buf.cursor, 6); // start of "world"
  });

  it('moveWordLeft skips spaces then word', () => {
    const buf = new TextBuffer();
    buf.insert('hello   world');
    buf.cursor = 8; // in the spaces
    buf.moveWordLeft();
    assert.equal(buf.cursor, 0); // start of "hello"
  });

  it('moveWordRight jumps to end of next word', () => {
    const buf = new TextBuffer();
    buf.insert('hello world');
    buf.cursor = 0;
    buf.moveWordRight();
    assert.equal(buf.cursor, 5); // end of "hello"
  });

  it('moveWordRight skips spaces then word', () => {
    const buf = new TextBuffer();
    buf.insert('hello   world');
    buf.cursor = 5; // end of "hello"
    buf.moveWordRight();
    assert.equal(buf.cursor, 13); // end of "world"
  });

  it('deleteWordForward removes next word', () => {
    const buf = new TextBuffer();
    buf.insert('hello world');
    buf.cursor = 0;
    buf.deleteWordForward();
    assert.equal(buf.text, ' world');
    assert.equal(buf.cursor, 0);
  });

  it('deleteWordForward at end is no-op', () => {
    const buf = new TextBuffer();
    buf.insert('hello');
    buf.deleteWordForward();
    assert.equal(buf.text, 'hello');
  });

  it('getText returns before-cursor and after-cursor parts', () => {
    const buf = new TextBuffer();
    buf.insert('hello world');
    buf.cursor = 5;
    assert.equal(buf.beforeCursor, 'hello');
    assert.equal(buf.afterCursor, ' world');
  });
});
