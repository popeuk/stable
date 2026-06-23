import { TimeRibbon } from "@/components/nav/time-ribbon";
import { Compass } from "@/components/nav/compass";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base">
      <TimeRibbon />
      <main className="mx-auto max-w-[480px] px-5 pb-32 pt-4">{children}</main>
      <Compass />
    </div>
  );
}
