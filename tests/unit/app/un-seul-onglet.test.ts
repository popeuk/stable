import { describe, expect, it, vi } from "vitest";

// Un BroadcastChannel entre onglets : ce qu'un onglet poste arrive chez les autres.
class Hub {
  canaux = new Set<{ onmessage: ((e: { data: unknown }) => void) | null }>();
  ouvrir() {
    const c = {
      onmessage: null as ((e: { data: unknown }) => void) | null,
      postMessage: (m: unknown) => {
        for (const o of this.canaux) if (o !== c) o.onmessage?.({ data: m });
      },
      close: () => this.canaux.delete(c),
    };
    this.canaux.add(c);
    return c;
  }
}

/** Un onglet : son propre module lib/onglet (chaque onglet a sa mémoire). */
async function onglet(hub: Hub) {
  vi.resetModules();
  const m = await import("@/lib/onglet");
  const fermer = m.brancherOnglet(() => hub.ouvrir());
  return { m, fermer };
}

describe("un seul onglet actif à la fois", () => {
  it("l'onglet qu'on ouvre prend la main, l'autre se met en pause ; « Reprendre ici » la rend", async () => {
    const hub = new Hub();
    const a = await onglet(hub);
    expect(a.m.ongletEnPause()).toBe(false);
    const b = await onglet(hub);
    expect(b.m.ongletEnPause()).toBe(false);
    expect(a.m.ongletEnPause()).toBe(true);
    const vu = vi.fn();
    b.m.ecouterOnglet(vu);
    a.m.prendreLaMain();
    expect(a.m.ongletEnPause()).toBe(false);
    expect(b.m.ongletEnPause()).toBe(true);
    expect(vu).toHaveBeenCalledTimes(1);
    a.fermer();
    b.fermer();
  });

  it("sans BroadcastChannel, rien ne change", async () => {
    vi.resetModules();
    const m = await import("@/lib/onglet");
    m.brancherOnglet(() => null);
    m.prendreLaMain();
    expect(m.ongletEnPause()).toBe(false);
  });

  it("un onglet en pause n'écrit plus rien dans le coffre", async () => {
    class Mem {
      m = new Map<string, string>();
      getItem(k: string) {
        return this.m.get(k) ?? null;
      }
      setItem(k: string, v: string) {
        this.m.set(k, v);
      }
      removeItem(k: string) {
        this.m.delete(k);
      }
      key(i: number) {
        return [...this.m.keys()][i] ?? null;
      }
      get length() {
        return this.m.size;
      }
    }
    const g = globalThis as unknown as { localStorage: Mem; window: object };
    g.localStorage = new Mem();
    g.window = globalThis;
    vi.resetModules();
    const hub = new Hub();
    const o = await import("@/lib/onglet");
    o.brancherOnglet(() => hub.ouvrir());
    const { vault } = await import("@/lib/account/vault");
    const { setSession } = await import("@/lib/account/session");
    setSession({ kind: "locale", at: "x" });
    await vault.setItem("be-stable-data", '{"state":{"horses":["A"]}}');
    expect(await vault.getItem("be-stable-data")).toBe('{"state":{"horses":["A"]}}');
    // Un autre onglet prend la main.
    hub.ouvrir().postMessage({ actif: "autre" });
    expect(o.ongletEnPause()).toBe(true);
    await vault.setItem("be-stable-data", '{"state":{"horses":[]}}');
    expect(await vault.getItem("be-stable-data")).toBe('{"state":{"horses":["A"]}}');
  });
});
