import { Redirect } from "@/components/bs/redirect";

/** L’ancien « Mon plan » : les pistes pour gagner plus, dans Mon bilan. */
export default function Page() {
  return <Redirect to="/argent?vue=leviers" />;
}
