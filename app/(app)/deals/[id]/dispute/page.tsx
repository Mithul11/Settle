import { notFound } from "next/navigation";
import { LoadError } from "@/components/app/load-error";
import { DisputeView } from "@/components/deal/dispute-view";
import { getDealDetail, isDbConfigured, logLoadError } from "@/lib/queries";
import { getRole } from "@/lib/role";

export default async function DisputePage({ params, searchParams }: PageProps<"/deals/[id]/dispute">) {
  const { id } = await params;
  const { m } = await searchParams;
  const role = await getRole();
  let deal;
  try {
    deal = await getDealDetail(id);
  } catch (error) {
    logLoadError("dispute page", error);
    return <LoadError what="this mediation" setup={!isDbConfigured()} />;
  }
  if (!deal) notFound();
  return <DisputeView deal={deal} role={role} milestoneId={typeof m === "string" ? m : null} />;
}
