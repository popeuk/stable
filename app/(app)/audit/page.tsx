import { Redirect } from "@/components/bs/redirect";

/** L’ancien « Audit du mois » : Mon bilan dit la même chose. */
export default function Page() {
  return <Redirect to="/argent" />;
}
