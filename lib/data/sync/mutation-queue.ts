/**
 * Offline mutation queue (spec section 13.3). A small, pure state machine over
 * a list of mutations, persisted through a pluggable QueueStorage adapter.
 * All transitions are deterministic and unit-tested.
 */
import type {
  Mutation,
  MutationType,
  QueueStorage,
  SyncTable,
} from "@/lib/data/sync/types";

export const MAX_RETRIES = 5;

let counter = 0;
function localId(): string {
  counter += 1;
  return `m-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export class MutationQueue {
  private mutations: Mutation[];

  constructor(private storage: QueueStorage) {
    this.mutations = storage.load();
  }

  /** Add a mutation in the `pending` state and persist. */
  enqueue(
    type: MutationType,
    table: SyncTable,
    payload: Record<string, unknown> & { id: string },
  ): Mutation {
    const mutation: Mutation = {
      id: localId(),
      type,
      table,
      payload,
      createdAt: Date.now(),
      status: "pending",
      retryCount: 0,
    };
    this.mutations.push(mutation);
    this.persist();
    return mutation;
  }

  /** Mutations eligible to sync now (pending, or failed under the retry cap). */
  pending(): Mutation[] {
    return this.mutations
      .filter(
        (m) =>
          m.status === "pending" ||
          (m.status === "failed" && m.retryCount < MAX_RETRIES),
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /** Mutations that exhausted their retries and need attention. */
  deadLettered(): Mutation[] {
    return this.mutations.filter(
      (m) => m.status === "failed" && m.retryCount >= MAX_RETRIES,
    );
  }

  all(): Mutation[] {
    return [...this.mutations];
  }

  markSyncing(id: string): void {
    this.update(id, (m) => ({ ...m, status: "syncing" }));
  }

  markCompleted(id: string): void {
    // Completed mutations are removed once confirmed by the server.
    this.mutations = this.mutations.filter((m) => m.id !== id);
    this.persist();
  }

  markFailed(id: string, error: string): void {
    this.update(id, (m) => ({
      ...m,
      status: "failed",
      errorMessage: error,
      retryCount: m.retryCount + 1,
    }));
  }

  /** Drop everything (e.g. after a full resync). */
  clear(): void {
    this.mutations = [];
    this.persist();
  }

  private update(id: string, fn: (m: Mutation) => Mutation): void {
    this.mutations = this.mutations.map((m) => (m.id === id ? fn(m) : m));
    this.persist();
  }

  private persist(): void {
    this.storage.save(this.mutations);
  }
}
