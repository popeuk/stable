import { describe, expect, it } from "vitest";
import { phraseCookies } from "@/components/bs/consentement";

describe("le bandeau des cookies, en mots simples", () => {
  it("dit à quoi ils servent, avec qui, et que rien ne part sans accord", () => {
    expect(phraseCookies(true, true)).toBe(
      "On aimerait savoir comment l’app est utilisée (avec Google) et si nos publicités marchent (avec Meta). Il faut pour ça des cookies, seulement si tu es d’accord. Les chiffres de ton écurie ne partent jamais.",
    );
    expect(phraseCookies(true, false)).toBe("On aimerait savoir comment l’app est utilisée (avec Google). Il faut pour ça des cookies, seulement si tu es d’accord. Les chiffres de ton écurie ne partent jamais.");
    expect(phraseCookies(false, true)).toMatch(/^On aimerait savoir si nos publicités marchent \(avec Meta\)\./);
  });
  it("sans mot de logiciel ni de juriste", () => {
    for (const p of [phraseCookies(true, true), phraseCookies(true, false), phraseCookies(false, true)]) expect(p).not.toMatch(/témoin|paramétr|pixel|audience/i);
  });
});
