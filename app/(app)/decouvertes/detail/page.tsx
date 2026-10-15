"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Empty, Page } from "@/components/carnet/ui";
import { InsightView } from "../insight-view";

/**
 * Discovery detail as a single static page reading ?id=. Insight ids depend on
 * the user's own horses, so they can't be pre-rendered into the path under
 * static export — they travel in the query string instead.
 */
export default function DecouverteDetailPage() {
  return (
    <Suspense fallback={null}>
      <DetailRoute />
    </Suspense>
  );
}

function DetailRoute() {
  const id = useSearchParams().get("id");
  if (!id) {
    return (
      <Page>
        <Empty ill="dodo">On ne retrouve pas cette remarque. Elle a peut-être disparu avec tes derniers chiffres.</Empty>
        <div className="pad" style={{ marginTop: 12 }}>
          <Link href="/decouvertes" className="btn line full">
            Ce qu’on a remarqué
          </Link>
        </div>
      </Page>
    );
  }
  return <InsightView id={id} />;
}
