import { describe, expect, it } from "vitest";
import { echeance, heure, jours, plage } from "@/lib/utils/heure";
import { hh } from "@/components/bs/seance-form";

const nb = (s: string) => s.replace(/ /g, " ");

describe("les heures et les jours comme on les dit", () => {
  it("« 9 h », « 9 h 30 », « 7 h 05 », jamais de zéro devant ni de deux-points", () => {
    expect(nb(heure("09:00"))).toBe("9 h");
    expect(nb(heure("09:30"))).toBe("9 h 30");
    expect(nb(heure("07:05"))).toBe("7 h 05");
    expect(nb(heure("18:00"))).toBe("18 h");
    expect(heure(undefined)).toBe("");
    expect(heure("bientôt")).toBe("bientôt");
    expect(heure("09:30")).not.toMatch(/ /);
    expect(hh("07:30")).toBe(heure("07:30"));
  });

  it("une séance : « 9 h à 10 h 30 »", () => {
    expect(nb(plage("09:00", "10:30"))).toBe("9 h à 10 h 30");
    expect(nb(plage("17:30"))).toBe("17 h 30");
  });

  it("« dans 3 jours », « en retard de 1 jour », jamais « 3 j »", () => {
    expect(nb(echeance(3))).toBe("dans 3 jours");
    expect(nb(echeance(1))).toBe("dans 1 jour");
    expect(nb(echeance(-1))).toBe("en retard de 1 jour");
    expect(echeance(0)).toBe("aujourd’hui");
    expect(nb(jours(12))).toBe("12 jours");
  });
});
