"use client";

import { useEffect } from "react";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { dayItems, resumeJournee } from "@/lib/domain/seances";
import { localToday } from "@/lib/utils/local-date";

/**
 * Le rappel : à l'heure choisie, une notification résume la journée ; le
 * soir, s'il reste des tâches pas cochées, un second rappel. Les séances et
 * les soins passés comptent tout seuls : rien à cocher pour eux. Sans serveur d'envoi, elle part quand
 * l'app est ouverte ou réveillée ; une seule fois par jour et par rappel.
 */
const KEY = "be-stable-nudges";

export function MorningNudge() {
  const reminder = useSettingsStore((s) => s.reminder);
  const evening = useSettingsStore((s) => s.evening);

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const check = () => {
      const now = new Date();
      const today = localToday(now);
      let sent: Record<string, string> = {};
      try {
        sent = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      } catch {}
      const data = useDataStore.getState();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const items = dayItems(data, today, today, hhmm);
      const tasks = items.filter((i) => i.type === "task" && !i.done);
      const [h, m] = reminder.split(":").map(Number);
      const minutes = now.getHours() * 60 + now.getMinutes();
      const notify = async (tag: string, title: string, body: string) => {
        sent[tag] = today;
        try {
          localStorage.setItem(KEY, JSON.stringify(sent));
        } catch {}
        const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
        if (reg) reg.showNotification(title, { body, tag });
        else new Notification(title, { body, tag });
      };
      if (minutes >= h * 60 + m && sent.morning !== today) {
        // Le même compte que l'accueil : toutes les choses du jour.
        const r = resumeJournee(items);
        notify("morning", r.titre, r.corps);
      } else if (evening && minutes >= 19 * 60 + 30 && tasks.length > 0 && sent.evening !== today) {
        notify(
          "evening",
          `Encore ${tasks.length} tâche${tasks.length > 1 ? "s" : ""} aujourd’hui`,
          `${tasks.slice(0, 3).map((i) => i.title).join(", ")}. Coche-les quand c’est fait.`,
        );
      }
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [reminder, evening]);

  return null;
}
