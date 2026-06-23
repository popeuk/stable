/**
 * Sync layer contracts (spec section 13). The queue, conflict resolution and
 * engine are all pure and unit-tested; the remote repository is the only part
 * that talks to Supabase.
 */

/** Tables that participate in offline sync. */
export type SyncTable =
  | "horses"
  | "revenues"
  | "direct_expenses"
  | "shared_expenses";

export type MutationType = "insert" | "update" | "delete";

export type MutationStatus = "pending" | "syncing" | "failed" | "completed";

export interface Mutation {
  /** Local UUID. */
  id: string;
  type: MutationType;
  table: SyncTable;
  /** The row payload (camelCase domain shape). For delete, only needs `id`. */
  payload: Record<string, unknown> & { id: string };
  createdAt: number;
  status: MutationStatus;
  errorMessage?: string;
  retryCount: number;
}

/** Persistence behind the mutation queue (IndexedDB/Dexie in production). */
export interface QueueStorage {
  load(): Mutation[];
  save(mutations: Mutation[]): void;
}

/** Abstracts the remote backend so the engine can be tested with a fake. */
export interface RemoteRepository {
  apply(mutation: Mutation): Promise<void>;
}

export interface SyncResult {
  completed: number;
  failed: number;
  remaining: number;
}
