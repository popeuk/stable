import Link from "next/link";
import { TopBar, HorseLine, Tag, ArrowDisc } from "./_ui";

/* Couverture — la promesse, claire, désirable, éditoriale. */
export default function ProtoCover() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col">
      <TopBar />

      {/* Bloc image éditorial */}
      <div className="relative mx-5 mt-4 overflow-hidden border border-[var(--o-line-strong)]">
        <div
          className="proto-grain relative flex aspect-[4/5] items-center justify-center"
          style={{
            background:
              "linear-gradient(160deg, var(--o-yellow-2) 0%, var(--o-yellow) 55%, #eab62f 100%)",
          }}
        >
          <HorseLine size={300} stroke={0.7} color="rgba(23,21,13,0.9)" />
          <div className="absolute left-4 top-4">
            <Tag tone="ink">Écuries de pension</Tag>
          </div>
          <div className="absolute bottom-4 right-4 text-right">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--o-ink)]/70">
              {"En 60 secondes"}
            </p>
          </div>
        </div>
      </div>

      {/* Titre éditorial */}
      <div className="px-5 pt-6">
        <h1 className="text-[40px] font-extrabold leading-[0.98]">
          {"Sache ce que"}
          <br />
          <span className="proto-outline">{"ton écurie"}</span>
          <br />
          {"gagne vraiment."}
        </h1>
        <p className="mt-4 max-w-[21rem] text-[15px] leading-relaxed text-[var(--o-muted)]">
          {
            "Be Stable est ton copilote chiffré. Il t’explique, cheval par cheval, ce qui te rapporte et ce qui te coûte — sans jargon, sans tableur."
          }
        </p>
      </div>

      {/* CTA */}
      <div className="mt-auto px-5 pb-7 pt-8">
        <Link
          href="/proto/onboarding"
          className="flex items-center justify-between border border-[var(--o-ink)] bg-[var(--o-ink)] py-2 pl-5 pr-2 text-[var(--o-bg)]"
        >
          <span className="text-[17px] font-bold">{"Commencer"}</span>
          <ArrowDisc size={44} />
        </Link>
        <p className="mt-3 text-center text-[12px] text-[var(--o-muted)]">
          {"Aucune carte bancaire. Tes données restent à toi."}
        </p>
      </div>
    </main>
  );
}
