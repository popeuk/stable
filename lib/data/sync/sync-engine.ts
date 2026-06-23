/**
 * Sync engine (spec section 13.2). Replays queued mutations against the remote
 * backend, marking each completed or failed. Retries use exponential backoff
 * driven by `retryCount`; the engine attempts every currently-eligible
 * mutation once per `processQueue()` pass, so a scheduler can re-invoke it on
 * an interval and on reconnect.
 */
import type {
  Mutation,
  RemoteRepository,
  SyncResult,
} from "@/lib/data/sync/types";
import { MutationQueue } from "@/lib/data/sync/mutation-queue";

/** Backoff delay before a failed mutation should be retried: 2s,4s,8s,16s,32s. */
export function backoffMs(retryCount: number): number {
  return 2000 * 2 ** retryCount;
}

export class SyncEngine {
  constructor(
    private queue: MutationQueue,
    private remote: RemoteRepository,
  ) {}

  /**
   * Attempt every eligible mutation once. Returns a summary. Each mutation is
   * isolated: one failure does not abort the rest of the batch.
   */
  async processQueue(): Promise<SyncResult> {
    const batch = this.eligibleNow();
    let completed = 0;
    let failed = 0;

    for (const mutation of batch) {
      this.queue.markSyncing(mutation.id);
      try {
        await this.remote.apply(mutation);
        this.queue.markCompleted(mutation.id);
        completed += 1;
      } catch (err) {
        this.queue.markFailed(
          mutation.id,
          err instanceof Error ? err.message : String(err),
        );
        failed += 1;
      }
    }

    return {
      completed,
      failed,
      remaining: this.queue.pending().length,
    };
  }

  /** Eligible mutations whose backoff window has elapsed. */
  private eligibleNow(now = Date.now()): Mutation[] {
    return this.queue.pending().filter((m) => {
      if (m.status !== "failed") return true;
      const readyAt = m.createdAt + backoffMs(m.retryCount - 1);
      return now >= readyAt;
    });
  }
}
