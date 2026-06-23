import type { Mutation, QueueStorage } from "@/lib/data/sync/types";

/** In-memory adapter — used in tests and as an SSR-safe fallback. */
export class InMemoryQueueStorage implements QueueStorage {
  private data: Mutation[] = [];
  load(): Mutation[] {
    return [...this.data];
  }
  save(mutations: Mutation[]): void {
    this.data = [...mutations];
  }
}

/**
 * localStorage adapter for the browser. The production target is IndexedDB via
 * Dexie (spec 2.3); this keeps the queue dependency-light and is a drop-in
 * replacement behind the same QueueStorage interface.
 */
export class LocalStorageQueueStorage implements QueueStorage {
  constructor(private key = "be-stable-mutation-queue") {}
  load(): Mutation[] {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as Mutation[]) : [];
    } catch {
      return [];
    }
  }
  save(mutations: Mutation[]): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(this.key, JSON.stringify(mutations));
  }
}
