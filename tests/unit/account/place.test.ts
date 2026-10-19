import { beforeEach, describe, expect, it } from "vitest";

// Un localStorage qui peut se remplir, comme dans le navigateur.
class Mem {
  m = new Map<string, string>();
  plein = false;
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    if (this.plein && k !== "be-stable-session") {
      const e = new Error("The quota has been exceeded.");
      e.name = "QuotaExceededError";
      throw e;
    }
    this.m.set(k, String(v));
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
const store = new Mem();
(globalThis as unknown as { localStorage: Mem }).localStorage = store;
(globalThis as unknown as { window: object }).window = globalThis;

const { vault } = await import("@/lib/account/vault");
const { setSession, clearSession } = await import("@/lib/account/session");
const place = await import("@/lib/account/place");

const key = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");

describe("plus de place sur l'appareil", () => {
  beforeEach(() => {
    store.m.clear();
    store.plein = false;
    clearSession();
    place._reinitialiserPlace();
  });

  it("une écriture refusée (QuotaExceededError) ne se perd plus : l'état le dit, avec l'heure du dernier enregistrement", async () => {
    setSession({ kind: "locale", at: "x" });
    await vault.setItem("be-stable-data", '{"state":{"a":1}}');
    expect(place.etatPlace().plein).toBe(false);
    store.plein = true;
    // L'écriture ne lève plus d'erreur perdue : elle se termine, et le refus est noté.
    await expect(vault.setItem("be-stable-data", '{"state":{"a":2}}')).resolves.toBeUndefined();
    const e = place.etatPlace();
    expect(e.plein).toBe(true);
    expect(e.depuis).not.toBeNull();
    // L'ancienne version est toujours là, la nouvelle n'est pas écrite.
    expect(store.getItem("be-stable-data@locale")).toBe('{"state":{"a":1}}');
    const msg = place.messagePlace(e, "ce téléphone")!;
    expect(msg.fort).toBe(true);
    expect(msg.texte).toMatch(/^Ton téléphone n’a plus de place pour Be Stable : rien n’est enregistré depuis \d+ h( \d\d)?\. Fais une sauvegarde, puis libère de la place \(photos, vidéos, applis dont tu ne te sers plus\)\.$/);
    // La place revient : le bandeau s'en va à la prochaine écriture.
    store.plein = false;
    await vault.setItem("be-stable-data", '{"state":{"a":3}}');
    expect(place.etatPlace().plein).toBe(false);
  });

  it("un compte : rien ne part en ligne quand l'écriture locale a échoué", async () => {
    setSession({ kind: "compte", userId: 3, email: "a@b.fr", prenom: "A", token: "t", dataKey: key(), at: "" });
    store.plein = true;
    await vault.setItem("be-stable-data", '{"state":{"a":1}}');
    expect(store.getItem("be-stable-data@u3")).toBeNull();
    expect(store.getItem("bs-nuage@u3")).toBeNull();
    expect(place.etatPlace().plein).toBe(true);
  });

  it("prévient doucement dès 70 % d'environ 5 Mo", () => {
    store.m.set("gros", "x".repeat(3_600_000));
    place.noterRangement(store, Date.now(), true);
    const e = place.etatPlace();
    expect(e.part).toBeGreaterThan(0.7);
    const msg = place.messagePlace(e, "cet ordinateur")!;
    expect(msg.fort).toBe(false);
    expect(msg.texte).toContain("cet ordinateur se remplit");
    store.m.set("gros", "x".repeat(1_000_000));
    place.noterRangement(store, Date.now(), true);
    expect(place.messagePlace(place.etatPlace(), "cet ordinateur")).toBeNull();
  });

  it("reconnaît le refus selon les navigateurs, et pas les autres erreurs", () => {
    expect(place.estPlacePleine({ name: "NS_ERROR_DOM_QUOTA_REACHED" })).toBe(true);
    expect(place.estPlacePleine({ code: 22 })).toBe(true);
    expect(place.estPlacePleine(new TypeError("x"))).toBe(false);
  });

  it("l'heure d'un autre jour donne la date", () => {
    const hier = new Date(2026, 9, 18, 10, 42).getTime();
    expect(place.heureDepuis(hier, new Date(2026, 9, 18, 15, 0).getTime())).toBe("10 h 42");
    expect(place.heureDepuis(hier, new Date(2026, 9, 19, 9, 0).getTime())).toBe("le 18 octobre à 10 h 42");
  });
});
