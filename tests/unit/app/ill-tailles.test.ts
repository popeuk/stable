import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ILL_TAILLES } from "@/components/carnet/ill-tailles";

/** Largeur et hauteur d'un .webp, lues dans son en-tête. */
function tailleWebp(b: Buffer): [number, number] {
  const t = b.toString("ascii", 12, 16);
  if (t === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (t === "VP8L") {
    const n = b.readUInt32LE(21);
    return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)];
  }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

describe("les dessins réservent leur place", () => {
  it("chaque dessin a sa taille, et c'est la bonne", () => {
    const dir = "public/img/carnet";
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".webp"))) {
      const n = f.slice(0, -5);
      expect(ILL_TAILLES[n], n).toEqual(tailleWebp(readFileSync(`${dir}/${f}`)));
    }
  });
});
