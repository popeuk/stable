import Link from "next/link";
import { redirect } from "next/navigation";

const isPages = process.env.DEPLOY_TARGET === "pages";

export default function RootPage() {
  if (!isPages) redirect("/maintenant");

  // Static export (GitHub Pages) can't server-redirect, so offer entry links.
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-primary">
        Be Stable
      </h1>
      <p className="text-secondary">Le copilote chiffré de ton écurie.</p>
      <div className="flex gap-3">
        <Link
          href="/maintenant"
          className="border border-[var(--text-primary)] bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-bold text-[#17150d]"
        >
          Ouvrir l&apos;app
        </Link>
        <Link
          href="/proto"
          className="border border-[var(--border-strong)] px-5 py-2.5 text-sm text-secondary"
        >
          Le prototype
        </Link>
      </div>
    </main>
  );
}
