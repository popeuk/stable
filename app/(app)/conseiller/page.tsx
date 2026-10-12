"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { HorseLine } from "@/components/ed/atoms";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useSettingsStore } from "@/stores/settings-store";
import { advisorAnswer, matchIntent, ADVISOR_TOPICS } from "@/lib/domain/advisor";

interface Msg {
  from: "user" | "coach";
  text: string;
}

export default function ConseillerPage() {
  return (
    <ClientGate>
      <Conseiller />
    </ClientGate>
  );
}

function Conseiller() {
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);
  const capacity = useSettingsStore((s) => s.capacity);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      from: "coach",
      text: "Salut. Pose-moi une question sur ce que te laisse l’écurie, ce qu’elle te coûte, le prix de tes pensions ou tes boxes libres. Je te réponds avec tes propres chiffres.",
    },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  function ask(key: string, label: string) {
    const answer = advisorAnswer(key, data, period, capacity);
    setMsgs((m) => [...m, { from: "user", text: label }, { from: "coach", text: answer }]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    ask(matchIntent(text), text);
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      <header className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center ink-panel text-[var(--on-ink)]">
          <HorseLine size={26} stroke={1.4} color="var(--accent-primary)" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-bricolage)] text-xl text-primary">Pose une question</h1>
          <p className="text-[12px] text-tertiary">Les réponses partent de ce que tu as noté dans l’app.</p>
        </div>
      </header>

      {/* Conversation */}
      <div className="flex-1 space-y-3">
        {msgs.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={m.from === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.from === "user"
                  ? "max-w-[80%] whitespace-pre-line bg-[var(--accent-primary)] px-3.5 py-2.5 text-[14px] font-medium text-[var(--on-accent)]"
                  : "max-w-[88%] whitespace-pre-line card px-3.5 py-2.5 text-[14px] leading-relaxed text-primary"
              }
            >
              {m.text}
            </div>
          </motion.div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-tertiary">
          Quelques idées de questions
        </p>
        <div className="flex flex-wrap gap-2">
          {ADVISOR_TOPICS.map((t) => (
            <button
              key={t.key}
              onClick={() => ask(t.key, t.question)}
              className="border border-[var(--border-strong)] px-3 py-1.5 text-[12px] font-semibold text-secondary"
            >
              {t.question}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-20 mt-3 flex items-center gap-2 border border-[var(--border-strong)] bg-base p-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Pose ta question…"
          className="flex-1 bg-transparent px-3 py-2 text-[14px] text-primary outline-none"
        />
        <button
          onClick={send}
          aria-label="Envoyer ma question"
          className="flex size-9 items-center justify-center bg-[var(--ink)] text-[var(--on-ink)]"
        >
          <Send size={16} />
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-tertiary">
        Pour l’instant, il comprend surtout les questions proposées au-dessus. Écrire librement viendra plus tard.
      </p>
    </div>
  );
}
