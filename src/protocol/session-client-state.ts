import { EventEmitter } from 'node:events';
import type {
  IRootState,
  ISessionState,
  IActionEnvelope,
  ISnapshot,
  URI,
  IStateAction,
} from './types/index.js';
import type { IRootAction, ISessionAction } from './types/index.js';
import type { IProtocolNotification } from './types/index.js';
import { rootReducer, sessionReducer, ActionType } from './types/index.js';


/** Root action types don't carry a session field. */
const ROOT_ACTION_TYPES = new Set<string>([
  ActionType.RootAgentsChanged,
  ActionType.RootActiveSessionsChanged,
]);

function isRootAction(action: IStateAction): action is IRootAction {
  return ROOT_ACTION_TYPES.has(action.type);
}

function getSessionUri(action: IStateAction): URI | undefined {
  if ('session' in action) {
    return action.session;
  }
  return undefined;
}


interface IPendingAction {
  clientSeq: number;
  action: IStateAction;
}


/**
 * Client-side state manager with write-ahead reconciliation.
 *
 * Maintains three conceptual state layers:
 * 1. **Confirmed state** — what the server has acknowledged
 * 2. **Pending actions** — optimistic actions not yet echoed by server
 * 3. **Optimistic state** — confirmed + pending replayed on top
 *
 * Components consume the optimistic state. When the server echoes back
 * an action (with matching clientSeq), it moves from pending to confirmed.
 */
export class SessionClientState extends EventEmitter {
  private confirmedRootState: IRootState | undefined;
  private readonly confirmedSessionStates = new Map<URI, ISessionState>();

  private readonly pendingActions: IPendingAction[] = [];
  private nextClientSeq = 1;

  private serverSeq = 0;
  private clientId: string | undefined;

  // Cached optimistic state (recomputed when confirmed or pending changes)
  private cachedOptimisticRoot: IRootState | undefined;
  private readonly cachedOptimisticSessions = new Map<URI, ISessionState>();
  private optimisticDirty = true;

  /**
   * Set the client ID used for reconciliation matching.
   */
  setClientId(clientId: string): void {
    this.clientId = clientId;
  }

  /**
   * Handle a snapshot received from subscribe or initialize.
   */
  handleSnapshot(snapshot: ISnapshot): void {
    const { resource, state, fromSeq } = snapshot;

    if (resource === 'agenthost:/root') {
      this.confirmedRootState = state as IRootState;
    } else {
      this.confirmedSessionStates.set(resource, state as ISessionState);
    }

    if (fromSeq !== undefined) {
      this.serverSeq = Math.max(this.serverSeq, fromSeq);
    }

    this.invalidateOptimistic();
    this.emitStateChange(resource);
  }

  /**
   * Optimistically apply an action locally (write-ahead).
   * Returns the clientSeq to include in the dispatchAction notification.
   */
  applyOptimistic(action: IStateAction): number {
    const clientSeq = this.nextClientSeq++;
    this.pendingActions.push({ clientSeq, action });
    this.invalidateOptimistic();

    const resource = isRootAction(action) ? 'agenthost:/root' : getSessionUri(action);
    if (resource) this.emitStateChange(resource);

    return clientSeq;
  }

  /**
   * Process an action envelope from the server.
   * This is the core reconciliation algorithm.
   */
  receiveEnvelope(envelope: IActionEnvelope): void {
    const { serverSeq, action, origin } = envelope;

    // Update server sequence
    this.serverSeq = serverSeq;

    // Check if this is an echo of our own optimistic action
    if (origin?.clientId && origin.clientId === this.clientId) {
      const idx = this.pendingActions.findIndex(
        (p) => p.clientSeq === origin.clientSeq
      );
      if (idx >= 0) {
        // Server acknowledged our action — remove from pending
        this.pendingActions.splice(idx, 1);
      }
    }

    // Apply to confirmed state
    if (isRootAction(action)) {
      if (this.confirmedRootState) {
        this.confirmedRootState = rootReducer(this.confirmedRootState, action);
      }
    } else {
      const sessionUri = getSessionUri(action);
      if (sessionUri) {
        const sessionState = this.confirmedSessionStates.get(sessionUri);
        if (sessionState) {
          this.confirmedSessionStates.set(
            sessionUri,
            sessionReducer(sessionState, action as ISessionAction),
          );
        }
      }
    }

    this.invalidateOptimistic();
    const resource = isRootAction(action) ? 'agenthost:/root' : getSessionUri(action);
    if (resource) this.emitStateChange(resource);
  }

  /**
   * Handle an ephemeral notification from the server.
   */
  receiveNotification(notification: IProtocolNotification): void {
    this.emit('notification', notification);
  }

  /**
   * Get the optimistic root state (confirmed + pending replayed).
   */
  getRootState(): IRootState | undefined {
    this.recomputeIfDirty();
    return this.cachedOptimisticRoot;
  }

  /**
   * Get the optimistic session state for a URI.
   */
  getSessionState(resource: URI): ISessionState | undefined {
    this.recomputeIfDirty();
    return this.cachedOptimisticSessions.get(resource);
  }

  getServerSeq(): number {
    return this.serverSeq;
  }

  private invalidateOptimistic(): void {
    this.optimisticDirty = true;
  }

  private recomputeIfDirty(): void {
    if (!this.optimisticDirty) return;
    this.optimisticDirty = false;

    // Start from confirmed state
    this.cachedOptimisticRoot = this.confirmedRootState;
    this.cachedOptimisticSessions.clear();
    for (const [uri, state] of this.confirmedSessionStates) {
      this.cachedOptimisticSessions.set(uri, state);
    }

    // Replay pending actions on top
    for (const pending of this.pendingActions) {
      const action = pending.action;
      if (isRootAction(action)) {
        if (this.cachedOptimisticRoot) {
          this.cachedOptimisticRoot = rootReducer(this.cachedOptimisticRoot, action);
        }
      } else {
        const sessionUri = getSessionUri(action);
        if (sessionUri) {
          const sessionState = this.cachedOptimisticSessions.get(sessionUri);
          if (sessionState) {
            this.cachedOptimisticSessions.set(
              sessionUri,
              sessionReducer(sessionState, action as ISessionAction),
            );
          }
        }
      }
    }
  }

  private emitStateChange(resource: URI): void {
    this.recomputeIfDirty();
    if (resource === 'agenthost:/root') {
      if (this.cachedOptimisticRoot) {
        this.emit('rootStateChanged', this.cachedOptimisticRoot);
      }
    } else {
      const state = this.cachedOptimisticSessions.get(resource);
      if (state) {
        this.emit('sessionStateChanged', resource, state);
      }
    }
  }
}
