import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { uriToDisplayPath, pathToUri, parentUri, childUri } from './uri-helpers.js';

describe('uriToDisplayPath', () => {
  it('strips file:// prefix', () => {
    assert.equal(uriToDisplayPath('file:///workspace'), '/workspace');
  });

  it('returns / for file:///', () => {
    assert.equal(uriToDisplayPath('file:///'), '/');
  });

  it('returns non-file URIs unchanged', () => {
    assert.equal(uriToDisplayPath('copilot:/abc'), 'copilot:/abc');
  });

  it('decodes percent-encoded characters', () => {
    assert.equal(uriToDisplayPath('file:///my%20folder'), '/my folder');
  });
});

describe('pathToUri', () => {
  it('converts a path to file:// URI', () => {
    assert.equal(pathToUri('/home/user'), 'file:///home/user');
  });

  it('converts root path', () => {
    assert.equal(pathToUri('/'), 'file:///');
  });
});

describe('parentUri', () => {
  it('navigates to parent directory', () => {
    assert.equal(parentUri('file:///home/user'), 'file:///home');
  });

  it('navigates from nested path', () => {
    assert.equal(parentUri('file:///a/b/c'), 'file:///a/b');
  });

  it('returns root for single-level path', () => {
    assert.equal(parentUri('file:///Users'), 'file:///');
  });

  it('stays at root when already at root', () => {
    assert.equal(parentUri('file:///'), 'file:///');
  });
});

describe('childUri', () => {
  it('appends child name to URI', () => {
    assert.equal(childUri('file:///home/user', 'Code'), 'file:///home/user/Code');
  });

  it('handles root directory', () => {
    assert.equal(childUri('file:///', 'Users'), 'file:///Users');
  });

  it('handles trailing slash in parent', () => {
    assert.equal(childUri('file:///Users/', 'penlv'), 'file:///Users/penlv');
  });
});
