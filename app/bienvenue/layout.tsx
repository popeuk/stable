import { ToastHost } from "@/components/bs/shell";

/** L'accueil des gérants : plein écran, le parcours gère lui-même sa mise en page (téléphone et ordinateur). */
export default function BienvenueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base text-primary">
      {children}
      <ToastHost />
    </div>
  );
}
