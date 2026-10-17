import { Redirect } from "@/components/bs/redirect";

/** L’ancien « Ce qu’on a remarqué » : les pistes pour gagner plus, dans Mon mois. */
export default function Page() {
  return <Redirect to="/argent?vue=leviers" />;
}
