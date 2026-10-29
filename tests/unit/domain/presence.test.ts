import { describe, expect, it } from "vitest";
import { auditPresence, compte, prochaine } from "@/lib/presence";

const MAINTENANT = new Date("2026-10-29T12:00:00");
const vide = {
  en_attente: false,
  adresse: "",
  commune: "",
  code_postal: "",
  site: "",
  places_libres: "",
  places_maj: undefined,
  prix_min: "",
  formules: [],
  photos: [],
  description: "",
  hebergement: [],
  installations: [],
  services: [],
  telephone: "",
  email: "",
};
const pleine = {
  ...vide,
  adresse: "1 chemin des Prés",
  commune: "Auch",
  code_postal: "32000",
  site: "https://ecurie.fr/",
  places_libres: "2",
  places_maj: "2026-10-20",
  prix_min: "280",
  photos: [1, 2, 3].map((id) => ({ id, url: "" })),
  description: "x".repeat(130),
  hebergement: ["Box"],
  installations: ["Carrière"],
  services: ["Foin"],
  telephone: "0600000000",
  email: "a@b.fr",
};

describe("auditPresence", () => {
  it("une fiche vide : le pire d'abord, et la première chose à faire est de dire ses places", () => {
    const e = auditPresence(vide, [], [], MAINTENANT);
    expect(e.map((x) => x.etat)).toEqual(["mid", "ko", "ko"]);
    expect(e[1].points[0].etat).toBe("ko");
    expect(prochaine(e)?.id).toBe("places");
  });

  it("une fiche remplie : tout va, rien à faire", () => {
    const e = auditPresence(pleine, [], [], MAINTENANT);
    expect(e.every((x) => x.etat === "ok")).toBe(true);
    expect(prochaine(e)).toBeNull();
    expect(compte(e[1])).toEqual({ ko: 0, mid: 0, ok: 5 });
  });

  it("des places de plus d'un mois sont à confirmer", () => {
    const e = auditPresence({ ...pleine, places_maj: "2026-09-01" }, [], [], MAINTENANT);
    expect(e[1].points.find((p) => p.id === "places")?.etat).toBe("mid");
  });

  it("une demande sans réponse depuis plus d'un jour coince ; répondue, elle va", () => {
    const d = { id: 7, date: "2026-10-27T10:00:00", reponses: [] };
    expect(auditPresence(pleine, [d], [], MAINTENANT)[2].points[0]).toMatchObject({ id: "reponse", etat: "ko" });
    expect(auditPresence(pleine, [d], [7], MAINTENANT)[2].etat).toBe("ok");
  });

  it("sans demande, pas de point sur les réponses", () => {
    expect(auditPresence(pleine, [], [], MAINTENANT)[2].points.some((p) => p.id === "reponse")).toBe(false);
  });
});
