import { Redirect } from "@/components/bs/redirect";

/** L'ancienne fiche cheval mène au ticket du cheval. */
export default function Page() {
  return <Redirect to="/ticket" keepQuery />;
}
