import { describe, it, expect, beforeEach } from "vitest";
import { MutationQueue, MAX_RETRIES } from "@/lib/data/sync/mutation-queue";
import { InMemoryQueueStorage } from "@/lib/data/sync/storage";
import { SyncEngine, backoffMs } from "@/lib/data/sync/sync-engine";
import type { Mutation, RemoteRepository } from "@/lib/data/sync/types";

function makeQueue() {
  return new MutationQueue(new InMemoryQueueStorage());
}

describe("MutationQueue", () => {
  it("enqueues in pending and persists across instances", () => {
    const storage = new InMemoryQueueStorage();
    const q1 = new MutationQueue(storage);
    q1.enqueue("insert", "horses", { id: "h1" });
    const q2 = new MutationQueue(storage);
    expect(q2.pending()).toHaveLength(1);
    expect(q2.pending()[0].table).toBe("horses");
  });

  it("removes a mutation once completed", () => {
    const q = makeQueue();
    const m = q.enqueue("insert", "revenues", { id: "r1" });
    q.markCompleted(m.id);
    expect(q.pending()).toHaveLength(0);
    expect(q.all()).toHaveLength(0);
  });

  it("increments retryCount on failure and dead-letters past the cap", () => {
    const q = makeQueue();
    const m = q.enqueue("insert", "revenues", { id: "r1" });
    for (let i = 0; i < MAX_RETRIES; i++) q.markFailed(m.id, "boom");
    expect(q.pending()).toHaveLength(0);
    expect(q.deadLettered()).toHaveLength(1);
    expect(q.deadLettered()[0].retryCount).toBe(MAX_RETRIES);
  });

  it("orders pending by creation time", () => {
    const q = makeQueue();
    const a = q.enqueue("insert", "horses", { id: "a" });
    const b = q.enqueue("insert", "horses", { id: "b" });
    expect(q.pending().map((m) => m.id)).toEqual([a.id, b.id]);
  });
});

describe("backoffMs", () => {
  it("doubles each retry starting at 2s", () => {
    expect(backoffMs(0)).toBe(2000);
    expect(backoffMs(1)).toBe(4000);
    expect(backoffMs(2)).toBe(8000);
    expect(backoffMs(3)).toBe(16000);
  });
});

describe("SyncEngine", () => {
  class FakeRemote implements RemoteRepository {
    applied: Mutation[] = [];
    failFor = new Set<string>();
    async apply(m: Mutation) {
      if (this.failFor.has(m.payload.id)) throw new Error("network");
      this.applied.push(m);
    }
  }

  let queue: MutationQueue;
  let remote: FakeRemote;
  let engine: SyncEngine;

  beforeEach(() => {
    queue = makeQueue();
    remote = new FakeRemote();
    engine = new SyncEngine(queue, remote);
  });

  it("applies all pending mutations and clears them", async () => {
    queue.enqueue("insert", "horses", { id: "h1" });
    queue.enqueue("insert", "revenues", { id: "r1" });
    const result = await engine.processQueue();
    expect(result.completed).toBe(2);
    expect(result.remaining).toBe(0);
    expect(remote.applied.map((m) => m.payload.id).sort()).toEqual(["h1", "r1"]);
  });

  it("keeps failed mutations queued for retry", async () => {
    remote.failFor.add("r1");
    queue.enqueue("insert", "revenues", { id: "r1" });
    const result = await engine.processQueue();
    expect(result.failed).toBe(1);
    expect(result.remaining).toBe(1);
    expect(queue.all()[0].retryCount).toBe(1);
  });

  it("isolates failures so the rest of the batch still syncs", async () => {
    remote.failFor.add("bad");
    queue.enqueue("insert", "horses", { id: "ok1" });
    queue.enqueue("insert", "horses", { id: "bad" });
    queue.enqueue("insert", "horses", { id: "ok2" });
    const result = await engine.processQueue();
    expect(result.completed).toBe(2);
    expect(result.failed).toBe(1);
    expect(remote.applied.map((m) => m.payload.id).sort()).toEqual(["ok1", "ok2"]);
  });

  it("does not retry a failed mutation before its backoff elapses", async () => {
    remote.failFor.add("r1");
    queue.enqueue("insert", "revenues", { id: "r1" });
    await engine.processQueue(); // fails once, retryCount = 1
    remote.failFor.delete("r1");
    // Immediately re-run: backoff (2s) has not elapsed, so nothing applied.
    const second = await engine.processQueue();
    expect(second.completed).toBe(0);
    expect(remote.applied).toHaveLength(0);
  });
});
