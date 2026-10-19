// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * Aucun nom de client ne part chez Google ou Meta (audit sécurité N1). La
 * mesure est allumée pour ce test (identifiants posés), sur une adresse
 * d'avant qui porte encore un nom : rien de ce qui est envoyé ne le contient.
 */
const NOM = "Mme Dupont";

describe("la mesure n'envoie jamais un nom de client", () => {
  it("Google : adresse sans sa recherche, titre fixe, témoins 13 mois ; Meta : sans collecte automatique", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST1234");
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL", "1234567890");
    vi.resetModules();
    window.history.pushState({}, "", `/client?nom=${encodeURIComponent(NOM)}&mois=2026-10#haut`);
    document.title = `${NOM} · Be Stable`;
    const m = await import("@/lib/mesure");
    expect(m.MESURE_POSEE).toBe(true);
    m.enregistrerChoix(true, true);
    m.mesurer("facture_faite");
    m.mesurer("compte_cree");

    const w = window as unknown as { dataLayer: IArguments[]; fbq: { queue: unknown[][]; disablePushState?: boolean } };
    const ga = w.dataLayer.map((a) => Array.from(a));
    const meta = w.fbq.queue;
    const tout = JSON.stringify([ga, meta]);
    expect(tout).not.toContain("Dupont");
    expect(tout).not.toContain(encodeURIComponent(NOM));
    // Toute adresse envoyée à Google est sans « ? » ni « # ».
    const adresses = ga.flatMap((a) => a.filter((x): x is { page_location: string } => !!x && typeof x === "object" && "page_location" in x)).map((x) => x.page_location);
    expect(adresses.length).toBeGreaterThan(1);
    for (const a of adresses) expect(a).toBe(`${location.origin}/client`);
    const config = ga.find((a) => a[0] === "config")![2] as Record<string, unknown>;
    expect(config).toMatchObject({ send_page_view: false, cookie_expires: 34_164_000, page_title: "Be Stable", allow_google_signals: false });
    // Meta : autoConfig coupé avant init, changements d'écran non suivis.
    const iSet = meta.findIndex((a) => a[0] === "set" && a[1] === "autoConfig" && a[2] === false);
    const iInit = meta.findIndex((a) => a[0] === "init");
    expect(iSet).toBeGreaterThanOrEqual(0);
    expect(iSet).toBeLessThan(iInit);
    expect(meta[iInit]).toEqual(["init", "1234567890"]);
    expect(w.fbq.disablePushState).toBe(true);
    vi.unstubAllEnvs();
  });

  it("les adresses des écrans d'un client ne portent pas son nom, et le retrouvent", async () => {
    const a = await import("@/lib/adresse-client");
    const carnet = { people: [{ name: NOM }], horses: [{ ownerName: "Hugo L." }], revenues: [{ payer: "Léa Martin" }] };
    for (const adr of [a.adresseClient(NOM), a.adresseClient("Hugo L.", "2026-10"), a.adresseFacture("Léa Martin", "2026-10"), a.adresseChevalDe("/saisie/cheval", NOM, "client")]) {
      expect(adr).not.toContain("Dupont");
      expect(adr).not.toContain("Hugo");
      expect(adr).not.toContain("Martin");
    }
    a._oublierAdresses();
    // Après un rechargement (plus rien en mémoire) : le nom revient du carnet.
    const sp = (u: string) => new URL(u, "https://app.bestable.fr").searchParams;
    const graine = localStorage.getItem("bs-graine-adresses");
    expect(graine).toBeTruthy();
    const adr = a.adresseClient("Hugo L.", "2026-10");
    a._oublierAdresses();
    expect(a.nomDeLAdresse(sp(adr), carnet)).toBe("Hugo L.");
    expect(a.nomDeLAdresse(sp("/client?c=inconnu"), carnet)).toBe("");
    // Un nom tout neuf, pas encore dans le carnet : gardé le temps de la navigation.
    const neuf = a.adresseChevalDe("/parcours/chevaux", "Nouveau Client");
    expect(a.nomDeLAdresse(sp(neuf), carnet, "proprietaire")).toBe("Nouveau Client");
    // Les anciennes adresses marchent toujours.
    expect(a.nomDeLAdresse(sp(`/client?nom=${encodeURIComponent(NOM)}`), carnet)).toBe(NOM);
    expect(a.nomDeLAdresse(sp(`/saisie/cheval?proprietaire=${encodeURIComponent(NOM)}`), carnet, "proprietaire")).toBe(NOM);
  });

  it("aucun écran ne construit plus une adresse avec un nom en clair", () => {
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.tsx?$/.test(f)) fichiers.push(p);
      }
    };
    for (const d of ["app", "components", "lib"]) parcourir(join(process.cwd(), d));
    const fautifs = fichiers.filter((f) => /[?&](nom|proprietaire|payer|client)=\$\{/.test(readFileSync(f, "utf8")));
    expect(fautifs).toEqual([]);
  });
});
