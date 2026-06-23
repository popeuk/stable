import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Coin, Wordmark, Pill } from "./_ui";

/* Premier contact : la promesse, en clair, en 5 secondes. */
export default function ProtoWelcome() {
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-6 pb-8 pt-6"
      style={{ background: "var(--p-purple)" }}
    >
      <Wordmark light />

      <div className="flex flex-1 flex-col justify-center py-10">
        <Pill bg="var(--p-lime)" className="mb-6 self-start">
          {"Pour les écuries de pension"}
        </Pill>

        <h1 className="proto-disp text-[44px] text-white">
          {"Sache enfin si ton écurie"}{" "}
          <span style={{ color: "var(--p-lime)" }}>{"gagne de l’argent"}</span>
        </h1>

        <p className="mt-5 max-w-[20rem] text-[17px] font-medium text-white/90">
          {
            "Be Stable, c’est ton copilote chiffré. Il t’apprend, semaine après semaine, quel cheval te rapporte vraiment — sans être comptable."
          }
        </p>

        <div className="mt-8 flex items-center gap-3">
          <span className="proto-disp text-[15px] text-white/80">
            {"En 60 secondes chrono"}
          </span>
        </div>
      </div>

      {/* Trois mini-preuves, format playful */}
      <div className="mb-6 grid grid-cols-3 gap-2">
        {[
          { t: "Saisis", s: "en 10 sec", bg: "var(--p-mint)" },
          { t: "Comprends", s: "tes marges", bg: "var(--p-peach)" },
          { t: "Décide", s: "plus malin", bg: "var(--p-pink)" },
        ].map((c) => (
          <div
            key={c.t}
            className="rounded-[18px] border-[2.5px] border-[var(--p-ink)] p-3"
            style={{ background: c.bg, boxShadow: "0 3px 0 var(--p-ink)" }}
          >
            <p className="proto-disp text-[15px]">{c.t}</p>
            <p className="text-[12px] font-semibold text-[var(--p-ink)]/70">{c.s}</p>
          </div>
        ))}
      </div>

      <Link
        href="/proto/onboarding"
        className="flex items-center justify-between rounded-full border-[2.5px] border-[var(--p-ink)] bg-[var(--p-ink)] px-3 py-3 pl-4 text-white"
        style={{ boxShadow: "0 4px 0 rgba(0,0,0,0.35)" }}
      >
        <span className="flex items-center gap-3">
          <Coin size={38} />
          <span className="proto-disp text-[18px]">{"C’est parti"}</span>
        </span>
        <ArrowRight className="mr-2" />
      </Link>
    </main>
  );
}
