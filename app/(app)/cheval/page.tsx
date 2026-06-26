"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ChevalView } from "./cheval-view";

/**
 * Horse detail as a single static page reading ?id=. Static export (Pages)
 * can't pre-render a route per user-created horse, so the id never lives in
 * the path — only in the query string.
 */
export default function ChevalPage() {
  return (
    <Suspense fallback={null}>
      <ChevalRoute />
    </Suspense>
  );
}

function ChevalRoute() {
  const id = useSearchParams().get("id");
  if (!id) {
    return (
      <div className="space-y-4">
        <Link href="/ecurie" className="inline-flex items-center gap-1 text-sm text-tertiary">
          <ChevronLeft size={16} /> Mon écurie
        </Link>
        <p className="text-secondary">Cheval introuvable.</p>
      </div>
    );
  }
  return <ChevalView id={id} />;
}
