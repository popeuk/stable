import { buildDemoData } from "@/lib/data/demo-data";
import { generateInsights } from "@/lib/domain/insights-engine";
import { currentPeriod } from "@/lib/utils/period";
import { InsightView } from "./insight-view";

// Pre-render the current period's insight ids for static export (Pages).
export function generateStaticParams() {
  const insights = generateInsights(buildDemoData(), currentPeriod());
  return insights.map((i) => ({ id: encodeURIComponent(i.id) }));
}

export default async function InsightPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InsightView id={id} />;
}
