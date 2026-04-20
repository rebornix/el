import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SessionClientState } from './session-client-state.js';
import type { IRootState, ISessionState, ISessionSummary } from './types/index.js';
import { SessionLifecycle, SessionStatus, ActionType } from './types/index.js';

function makeRootState(overrides?: Partial<IRootState>): IRootState {
  return {
    agents: [],
    ...overrides,
  };
}

function makeSessionSummary(overrides?: Partial<ISessionSummary>): ISessionSummary {
  return {
    resource: 'copilot:/abc',
    provider: 'copilot',
    title: 'Test Session',
    status: SessionStatus.Idle,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    ...overrides,
  };
}

function makeSessionState(overrides?: Partial<ISessionState>): ISessionState {
  return {
    summary: makeSessionSummary(),
    lifecycle: SessionLifecycle.Ready,
    turns: [],
    pendingMessages: [],
    ...overrides,
  } as ISessionState;
}

describe('SessionClientState', () => {
  let state: SessionClientState;

  beforeEach(() => {
    state = new SessionClientState();
    state.setClientId('test-client');
  });

  describe('snapshots', () => {
    it('handles root state snapshot', () => {
      const rootState = makeRootState({
        agents: [{ provider: 'copilot', displayName: 'Copilot' } as any],
      });

      state.handleSnapshot({
        resource: 'agenthost:/root',
        state: rootState,
        fromSeq: 5,
      });

      assert.deepEqual(state.getRootState(), rootState);
      assert.equal(state.getServerSeq(), 5);
    });

    it('handles session state snapshot', () => {
      const sessionState = makeSessionState();

      state.handleSnapshot({
        resource: 'copilot:/abc',
        state: sessionState,
        fromSeq: 10,
      });

      assert.deepEqual(state.getSessionState('copilot:/abc'), sessionState);
      assert.equal(state.getServerSeq(), 10);
    });

    it('emits rootStateChanged on root snapshot', () => {
      let emitted: IRootState | undefined;
      state.on('rootStateChanged', (s) => { emitted = s; });

      state.handleSnapshot({
        resource: 'agenthost:/root',
        state: makeRootState(),
        fromSeq: 0,
      });

      assert.ok(emitted);
    });

    it('emits sessionStateChanged on session snapshot', () => {
      let emittedUri: string | undefined;
      state.on('sessionStateChanged', (uri) => { emittedUri = uri; });

      state.handleSnapshot({
        resource: 'copilot:/abc',
        state: makeSessionState(),
        fromSeq: 0,
      });

      assert.equal(emittedUri, 'copilot:/abc');
    });
  });

  describe('receiveEnvelope', () => {
    it('applies root action to confirmed state', () => {
      state.handleSnapshot({
        resource: 'agenthost:/root',
        state: makeRootState(),
        fromSeq: 0,
      });

      state.receiveEnvelope({
        serverSeq: 1,
        action: {
          type: ActionType.RootAgentsChanged,
          agents: [{ provider: 'mock', displayName: 'Mock Agent' } as any],
        },
        origin: undefined,
      });

      const root = state.getRootState();
      assert.ok(root);
      assert.equal(root.agents.length, 1);
      assert.equal(root.agents[0]!.provider, 'mock');
      assert.equal(state.getServerSeq(), 1);
    });

    it('applies session action to confirmed state', () => {
      state.handleSnapshot({
        resource: 'copilot:/abc',
        state: makeSessionState(),
        fromSeq: 0,
      });

      state.receiveEnvelope({
        serverSeq: 1,
        action: {
          type: ActionType.SessionTitleChanged,
          session: 'copilot:/abc',
          title: 'New Title',
        },
        origin: undefined,
      });

      const s = state.getSessionState('copilot:/abc');
      assert.ok(s);
      assert.equal(s.summary.title, 'New Title');
    });
  });

  describe('write-ahead reconciliation', () => {
    it('applies optimistic action to state', () => {
      state.handleSnapshot({
        resource: 'copilot:/abc',
        state: makeSessionState(),
        fromSeq: 0,
      });

      const clientSeq = state.applyOptimistic({
        type: ActionType.SessionTitleChanged,
        session: 'copilot:/abc',
        title: 'Optimistic Title',
      });

      assert.equal(clientSeq, 1);
      const s = state.getSessionState('copilot:/abc');
      assert.ok(s);
      assert.equal(s.summary.title, 'Optimistic Title');
    });

    it('removes pending action when server echoes it', () => {
      state.handleSnapshot({
        resource: 'copilot:/abc',
        state: makeSessionState(),
        fromSeq: 0,
      });

      const clientSeq = state.applyOptimistic({
        type: ActionType.SessionTitleChanged,
        session: 'copilot:/abc',
        title: 'Optimistic Title',
      });

      // Server echoes back with our clientSeq
      state.receiveEnvelope({
        serverSeq: 1,
        action: {
          type: ActionType.SessionTitleChanged,
          session: 'copilot:/abc',
          title: 'Optimistic Title',
        },
        origin: { clientId: 'test-client', clientSeq },
      });

      const s = state.getSessionState('copilot:/abc');
      assert.ok(s);
      assert.equal(s.summary.title, 'Optimistic Title');
    });

    it('increments clientSeq', () => {
      state.handleSnapshot({
        resource: 'copilot:/abc',
        state: makeSessionState(),
        fromSeq: 0,
      });

      const seq1 = state.applyOptimistic({
        type: ActionType.SessionTitleChanged,
        session: 'copilot:/abc',
        title: 'Title 1',
      });
      const seq2 = state.applyOptimistic({
        type: ActionType.SessionTitleChanged,
        session: 'copilot:/abc',
        title: 'Title 2',
      });

      assert.equal(seq2, seq1 + 1);
    });

    it('replays pending actions after concurrent server action', () => {
      state.handleSnapshot({
        resource: 'copilot:/abc',
        state: makeSessionState(),
        fromSeq: 0,
      });

      // Client optimistically sets title
      state.applyOptimistic({
        type: ActionType.SessionTitleChanged,
        session: 'copilot:/abc',
        title: 'Client Title',
      });

      // Server sends a different action (from another client)
      state.receiveEnvelope({
        serverSeq: 1,
        action: {
          type: ActionType.SessionTitleChanged,
          session: 'copilot:/abc',
          title: 'Server Title',
        },
        origin: { clientId: 'other-client', clientSeq: 1 },
      });

      // Our pending action is replayed on top of the server's confirmed state
      const s = state.getSessionState('copilot:/abc');
      assert.ok(s);
      assert.equal(s.summary.title, 'Client Title');
    });
  });

  describe('notifications', () => {
    it('emits notifications', () => {
      let received: unknown;
      state.on('notification', (n) => { received = n; });

      state.receiveNotification({
        type: 'notify/sessionAdded' as any,
        summary: makeSessionSummary(),
      } as any);

      assert.ok(received);
    });
  });
});
