import { describe, expect, it } from "vitest";
import { esc, msgFairePayer } from "@/lib/utils/esc";

describe("les textes saisis ne deviennent jamais du HTML (P2-1)", () => {
  it("un nom de dépense piégé reste du texte dans « Faire payer »", () => {
    const m = msgFairePayer('<img src=x onerror="document.body.dataset.xss=1">', "Léa <b>B.</b>", "60 €");
    expect(m).not.toMatch(/<img|<b>/);
    expect(m).toContain("&lt;img src=x onerror=&quot;document.body.dataset.xss=1&quot;&gt;");
    expect(m).toContain("<strong>+60 €</strong>");
  });
  it("esc échappe aussi l'apostrophe", () => expect(esc("l'<x>&")).toBe("l&#39;&lt;x&gt;&amp;"));
});
