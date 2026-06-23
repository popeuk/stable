/**
 * Browser wiring for the sync layer. Everything here is a safe no-op until
 * NEXT_PUBLIC_SUPABASE_* are configured, so the app runs local-only by default
 * (spec section 13) without any behavioural change.
 */
import { getSupabaseBrowserClient, isRemoteConfigured } from "@/lib/data/supabase";
import { MutationQueue } from "@/lib/data/sync/mutation-queue";
import { SyncEngine } from "@/lib/data/sync/sync-engine";
import { LocalStorageQueueStorage } from "@/lib/data/sync/storage";
import { SupabaseRemoteRepository } from "@/lib/data/repositories/remote-repository";
import type { MutationType, SyncTable } from "@/lib/data/sync/types";

export * from "@/lib/data/sync/types";
export { MutationQueue } from "@/lib/data/sync/mutation-queue";
export { SyncEngine, backoffMs } from "@/lib/data/sync/sync-engine";

let queueSingleton: MutationQueue | null = null;
let engineSingleton: SyncEngine | null = null;

export function getQueue(): MutationQueue {
  if (!queueSingleton) {
    queueSingleton = new MutationQueue(new LocalStorageQueueStorage());
  }
  return queueSingleton;
}

/** Returns the engine, or null when there is no remote to sync to. */
export function getSyncEngine(): SyncEngine | null {
  if (!isRemoteConfigured()) return null;
  if (!engineSingleton) {
    const client = getSupabaseBrowserClient();
    if (!client) return null;
    engineSingleton = new SyncEngine(getQueue(), new SupabaseRemoteRepository(client));
  }
  return engineSingleton;
}

/**
 * Record a mutation for eventual sync. No-op when remote is not configured,
 * so callers (e.g. the data store) can invoke it unconditionally.
 */
export function enqueueMutation(
  type: MutationType,
  table: SyncTable,
  payload: Record<string, unknown> & { id: string },
): void {
  if (!isRemoteConfigured()) return;
  getQueue().enqueue(type, table, payload);
}

/** Drain the queue once. Resolves to null when there is nothing to sync to. */
export async function processPendingSync() {
  const engine = getSyncEngine();
  if (!engine) return null;
  return engine.processQueue();
}

/** Number of mutations still waiting to reach the server. */
export function pendingCount(): number {
  if (!isRemoteConfigured()) return 0;
  return getQueue().pending().length;
}
