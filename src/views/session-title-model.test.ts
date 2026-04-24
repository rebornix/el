import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toSingleLineTitle, looksLikeGenericTitle, firstPromptTitle } from './session-title-model.js';

describe('toSingleLineTitle', () => {
  it('returns (untitled) for undefined input', () => {
    assert.equal(toSingleLineTitle(undefined), '(untitled)');
  });

  it('passes through a short plain title', () => {
    assert.equal(toSingleLineTitle('Hello world'), 'Hello world');
  });

  it('strips attachment tags', () => {
    assert.equal(
      toSingleLineTitle('Fix <attachment path="a.ts">code</attachment> bug'),
      'Fix bug',
    );
  });

  it('strips attachments wrapper tags but keeps inner text', () => {
    assert.equal(
      toSingleLineTitle('Fix <attachments>stuff</attachments> bug'),
      'Fix stuff bug',
    );
  });

  it('strips reminder tags', () => {
    assert.equal(
      toSingleLineTitle('Do <reminder>some long reminder text</reminder> this'),
      'Do this',
    );
  });

  it('collapses whitespace and newlines', () => {
    assert.equal(toSingleLineTitle('hello\n\tworld  foo'), 'hello world foo');
  });

  it('truncates with ellipsis at max length', () => {
    const long = 'a'.repeat(100);
    const result = toSingleLineTitle(long, 10);
    assert.equal(result.length, 10);
    assert.ok(result.endsWith('…'));
  });

  it('does not truncate at exactly max length', () => {
    const exact = 'a'.repeat(10);
    assert.equal(toSingleLineTitle(exact, 10), exact);
  });
});

describe('looksLikeGenericTitle', () => {
  it('returns true for undefined', () => {
    assert.equal(looksLikeGenericTitle(undefined), true);
  });

  it('returns true for empty string', () => {
    assert.equal(looksLikeGenericTitle(''), true);
  });

  it('returns true for whitespace-only', () => {
    assert.equal(looksLikeGenericTitle('   '), true);
  });

  it('returns true for "session" (case-insensitive)', () => {
    assert.equal(looksLikeGenericTitle('Session'), true);
    assert.equal(looksLikeGenericTitle('SESSION'), true);
  });

  it('returns true for URI-like titles', () => {
    assert.equal(looksLikeGenericTitle('https://example.com'), true);
    assert.equal(looksLikeGenericTitle('file:/foo'), true);
  });

  it('returns false for a real title', () => {
    assert.equal(looksLikeGenericTitle('Fix the login bug'), false);
  });
});

describe('firstPromptTitle', () => {
  it('returns "New session" for empty text', () => {
    assert.equal(firstPromptTitle(''), 'New session');
  });

  it('returns "New session" for whitespace-only text', () => {
    assert.equal(firstPromptTitle('   '), 'New session');
  });

  it('collapses whitespace and newlines', () => {
    assert.equal(firstPromptTitle('hello\n\tworld'), 'hello world');
  });

  it('passes through short text unchanged', () => {
    assert.equal(firstPromptTitle('Fix the bug'), 'Fix the bug');
  });

  it('truncates with ellipsis at max length', () => {
    const long = 'word '.repeat(20);
    const result = firstPromptTitle(long, 20);
    assert.equal(result.length, 20);
    assert.ok(result.endsWith('…'));
  });

  it('does not truncate at exactly max length', () => {
    const exact = 'a'.repeat(64);
    assert.equal(firstPromptTitle(exact), exact);
  });
});
