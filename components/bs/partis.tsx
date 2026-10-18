"use client";

import Link from "next/link";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { Face, Sec } from "@/components/carnet/ui";
import { esc } from "@/components/bs/ui";

const jour = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Les chevaux partis : toujours retrouvables (leur ticket des mois où ils
 * étaient là), et un cheval peut revenir. Rien ne s'affiche s'il n'y en a pas.
 */
export function Partis({ delay = 0.36 }: { delay?: number }) {
  const horses = useDataStore((s) => s.horses);
  const restore = useDataStore((s) => s.restoreHorse);
  const say = useUiStore((s) => s.say);
  const partis = horses.filter((h) => h.isArchived).sort((a, b) => (b.exitDate ?? "").localeCompare(a.exitDate ?? ""));
  if (!partis.length) return null;
  return (
    <Sec title={partis.length > 1 ? `Partis · ${partis.length}` : "Parti"} delay={delay}>
      <div className="rows">
        {partis.map((h) => (
          <div key={h.id} className="li">
            <Face horse={h} />
            <Link href={`/ticket?id=${h.id}`} style={{ minWidth: 0, flex: 1 }}>
              <b>{h.name}</b>
              <small>{h.exitDate ? `parti le ${jour(h.exitDate)}` : "parti"}{h.ownerName ? ` · ${h.ownerName}` : ""}</small>
            </Link>
            <button
              type="button"
              className="lnk"
              onClick={() => {
                const snap = useDataStore.getState();
                const back = { horses: snap.horses, revenues: snap.revenues };
                restore(h.id);
                say(`<strong>${esc(h.name)}</strong> est de retour. Sa pension compte à nouveau.`, () => useDataStore.setState(back));
              }}
            >
              Le faire revenir
            </button>
          </div>
        ))}
      </div>
    </Sec>
  );
}
