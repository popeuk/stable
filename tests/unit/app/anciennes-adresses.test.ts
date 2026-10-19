import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { LEGACY_REDIRECT } from "@/lib/anciennes-adresses";
import { api } from "@/lib/account/api";

/** Le script de la page introuvable, joué sur une adresse : où il renvoie (null s'il ne fait rien). */
function vers(pathname: string, search = "", hash = ""): string | null {
  let dest: string | null = null;
  const location = { pathname, search, hash, replace: (u: string) => (dest = u) };
  new Function("location", LEGACY_REDIRECT)(location);
  return dest;
}

describe("les anciennes adresses (404.html)", () => {
  it("le mot de passe oublié et le nouveau mot de passe mènent à la connexion par code", () => {
    expect(vers("/compte/oubli/")).toBe("/compte/connexion/");
    expect(vers("/compte/nouveau-mot-de-passe/", "?login=a&key=b")).toBe("/compte/connexion/");
    expect(vers("/stable/compte/oubli")).toBe("/stable/compte/connexion/");
  });

  it("les autres règles ne bougent pas", () => {
    expect(vers("/cheval/horse-3", "?vue=x")).toBe("/ticket?id=horse-3&vue=x");
    expect(vers("/proto/vieux")).toBe("/");
    expect(vers("/inconnue")).toBeNull();
    expect(vers("/compte/connexion/")).toBeNull();
  });

  it("plus d'écran ni d'appel pour le mot de passe", () => {
    expect(existsSync(join(process.cwd(), "app/compte/oubli"))).toBe(false);
    expect(existsSync(join(process.cwd(), "app/compte/nouveau-mot-de-passe"))).toBe(false);
    for (const k of ["inscription", "connexion", "oubli", "nouveau"]) expect(k in api).toBe(false);
  });
});
