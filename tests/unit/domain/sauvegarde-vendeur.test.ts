import { describe, expect, it } from "vitest";
import { changementsVendeur } from "@/lib/domain/facture";
import type { BillingInfo } from "@/lib/domain/types";

const app: BillingInfo = { statut: "ei", nomPrenom: "Julie Martin", iban: "FR76 3000 6000 0112 3456 7890 189", siret: "12345678900012" };

describe("ouvrir une sauvegarde qui change ce qui s'imprime sur les factures", () => {
  it("le même vendeur (espaces et casse mis à part) : rien à dire", () => {
    expect(changementsVendeur(app, { ...app, iban: "fr7630006000011234567890189", siret: "123 456 789 00012", nomPrenom: "julie martin" })).toEqual([]);
  });

  it("un autre IBAN, un autre SIRET, un autre nom : chacun est dit, en clair", () => {
    expect(changementsVendeur(app, { statut: "ei", nomPrenom: "Marc Dupuis", iban: "FR7612345678901234567890123", siret: "98765432100019" })).toEqual([
      "Cette sauvegarde change ton IBAN, ton SIRET et le nom sur tes factures : FR76 1234 5678 9012 3456 7890 123, 987 654 321 00019, Marc Dupuis.",
    ]);
    expect(changementsVendeur(app, { ...app, iban: "FR7612345678901234567890123", siret: "98765432100019" })).toEqual(["Cette sauvegarde change ton IBAN et ton SIRET : FR76 1234 5678 9012 3456 7890 123, 987 654 321 00019."]);
  });

  it("un fichier sans vendeur, ou abîmé, retire ce que l'app a ; une app vide n'a rien à protéger", () => {
    expect(changementsVendeur(app, undefined)).toEqual(["Cette sauvegarde retire ton IBAN, ton SIRET et le nom sur tes factures."]);
    expect(changementsVendeur(app, { ...app, iban: 42 })).toEqual(["Cette sauvegarde retire ton IBAN."]);
    expect(changementsVendeur(undefined, { iban: "FR7612345678901234567890123" })).toEqual([]);
  });
});
