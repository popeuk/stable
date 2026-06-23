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
      text: "Salut. Je suis ton conseiller. Pose-moi une question sur ta rentabilité, tes coûts, ton tarif ou tes places — je réponds avec tes chiffres.",
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
        <div className="flex size-10 items-center justify-center border border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]">
          <HorseLine size={26} stroke={1.4} color="var(--accent-primary)" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-fraunces)] text-xl text-primary">Le conseiller</h1>
          <p className="text-[12px] text-tertiary">Il répond à partir de tes données.</p>
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
                  ? "max-w-[80%] whitespace-pre-line bg-[var(--accent-primary)] px-3.5 py-2.5 text-[14px] font-medium text-[#17150d]"
                  : "max-w-[88%] whitespace-pre-line border border-[var(--border-strong)] bg-elevated px-3.5 py-2.5 text-[14px] leading-relaxed text-primary"
              }
            >
              {m.text}
            </div>
          </motion.div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <div className="mt-4 flex flex-wrap gap-2">
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
          aria-label="Envoyer"
          className="flex size-9 items-center justify-center bg-[var(--text-primary)] text-[var(--bg-base)]"
        >
          <Send size={16} />
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-tertiary">
        Le conseiller s&apos;appuie sur tes chiffres. La compréhension en langage libre (IA connectée)
        arrive avec la version cloud.
      </p>
    </div>
  );
}
