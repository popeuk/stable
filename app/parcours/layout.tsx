import { ToastHost } from "@/components/bs/shell";

/** Le parcours de démarrage : plein écran, sans barre d'onglets. */
export default function ParcoursLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base text-primary">
      <main className="mx-auto max-w-[480px] px-5 pb-16" style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}>
        {children}
      </main>
      <ToastHost />
    </div>
  );
}
