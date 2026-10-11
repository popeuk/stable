"use client";

import { useEffect } from "react";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { dayItems, toValidate } from "@/lib/domain/seances";
import { localToday } from "@/lib/utils/local-date";

/**
 * Le rappel : à l'heure choisie (et le soir s'il reste quelque chose), une
 * notification résume la journée. Sans serveur d'envoi, elle part quand
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
      const todays = dayItems(data, today, today, hhmm).filter((i) => !i.done);
      const late = toValidate(data, today, hhmm);
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
        notify(
          "morning",
          `Ta journée : ${todays.length} chose${todays.length > 1 ? "s" : ""}`,
          todays.length ? todays.slice(0, 3).map((i) => `${i.start ? `${i.start} ` : ""}${i.title}`).join(", ") : "Rien de prévu. Une journée pour avancer.",
        );
      } else if (evening && minutes >= 19 * 60 + 30 && late.length > 0 && sent.evening !== today) {
        notify("evening", `${late.length} chose${late.length > 1 ? "s" : ""} à valider`, "Valide ce qui a eu lieu : le compteur du mois ne compte que ça.");
      }
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [reminder, evening]);

  return null;
}
