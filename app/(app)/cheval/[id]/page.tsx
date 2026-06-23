import { buildDemoData } from "@/lib/data/demo-data";
import { ChevalView } from "./cheval-view";

// Pre-render the demo horses so the route works under static export (Pages).
export function generateStaticParams() {
  return buildDemoData().horses.map((h) => ({ id: h.id }));
}

export default async function ChevalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChevalView id={id} />;
}
