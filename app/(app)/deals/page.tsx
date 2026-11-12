import { redirect } from "next/navigation";

// /deals has no list page of its own: every deal is listed on the dashboard.
export default function DealsIndex() {
  redirect("/dashboard");
}
