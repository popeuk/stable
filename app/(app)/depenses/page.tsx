import { Redirect } from "@/components/bs/redirect";

/** L’ancienne liste des entrées et sorties : l’historique de Mon mois. */
export default function Page() {
  return <Redirect to="/argent?vue=mouvements" />;
}
