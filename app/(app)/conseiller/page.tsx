"use client";

import { useRef, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Hello, Ic, Page, Sec } from "@/components/carnet/ui";
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
    <Page>
      <h1 className="ar-sr">Pose une question</h1>
      <Hello title="Pose une question" sub="Les réponses partent de ce que tu as noté dans l’app." />

      {/* Conversation */}
      <div className="ar-chat" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`ar-msg ${m.from === "user" ? "me" : "card"} rise`}>
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <Sec title="Quelques idées de questions" nomarge>
        <div className="chips" style={{ marginTop: 10 }}>
          {ADVISOR_TOPICS.map((t) => (
            <button key={t.key} type="button" className="chip" onClick={() => ask(t.key, t.question)}>
              {t.question}
            </button>
          ))}
        </div>
      </Sec>

      {/* Input */}
      <div className="ar-ask">
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Pose ta question…"
          aria-label="Ta question"
        />
        <button type="button" className="btn" onClick={send} aria-label="Envoyer ma question">
          <Ic n="arrow" className="" />
        </button>
      </div>
      <p className="note pad" style={{ textAlign: "center", fontSize: 12 }}>
        Pour l’instant, il comprend surtout les questions proposées au-dessus. Écrire librement viendra plus tard.
      </p>
      <div className="end" />
    </Page>
  );
}
