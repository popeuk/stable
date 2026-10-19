// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useConfirmer } from "@/components/bs/confirmer";

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};

function Essai({ reponses }: { reponses: boolean[] }) {
  const [demander, feuille] = useConfirmer();
  const poser = async () => reponses.push(await demander({ titre: "Arrêter cette rentrée d’argent ?", texte: "Octobre compte encore.", oui: "Oui, l’arrêter" }));
  return h("div", null, h("button", { type: "button", onClick: poser }, "Arrêter"), feuille);
}

describe("la question oui ou non dans une feuille de l'app", () => {
  it("pose la question dans une feuille, rend oui ou non", async () => {
    const reponses: boolean[] = [];
    render(h(Essai, { reponses }));
    fireEvent.click(screen.getByText("Arrêter"));
    expect(await screen.findByRole("alertdialog", { name: "Arrêter cette rentrée d’argent ?" })).toBeTruthy();
    expect(screen.getByText("Octobre compte encore.")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText("Oui, l’arrêter")));
    expect(reponses).toEqual([true]);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByText("Arrêter"));
    await act(async () => fireEvent.click(await screen.findByText("Non")));
    expect(reponses).toEqual([true, false]);
  });
});
