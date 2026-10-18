// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { useTitreOnglet } from "@/components/bs/titre-onglet";

function T({ t }: { t: string | null }) {
  useTitreOnglet(t);
  return null;
}

describe("le titre de l'onglet suit la page ouverte", () => {
  it("pose « Chevaux · Be Stable », le remet si Next le change, le rend en partant", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.title = "Clients · Be Stable";
    const el = document.createElement("div");
    const root = createRoot(el);
    await act(async () => root.render(createElement(T, { t: "Chevaux" })));
    expect(document.title).toBe("Chevaux · Be Stable");
    document.title = "Clients · Be Stable";
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(document.title).toBe("Chevaux · Be Stable");
    await act(async () => root.render(createElement(T, { t: null })));
    expect(document.title).toBe("Clients · Be Stable");
    root.unmount();
  });
});
