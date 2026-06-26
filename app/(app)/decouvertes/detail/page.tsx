"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";
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
      <div className="space-y-4">
        <Link href="/decouvertes" className="inline-flex items-center gap-1 text-sm text-tertiary">
          <ChevronLeft size={16} /> Découvertes
        </Link>
        <p className="text-secondary">Découverte introuvable.</p>
      </div>
    );
  }
  return <InsightView id={id} />;
}
