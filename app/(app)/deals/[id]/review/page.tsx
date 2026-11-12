import { notFound } from "next/navigation";
import { LoadError } from "@/components/app/load-error";
import { ReviewView } from "@/components/deal/review-view";
import { getDealDetail, isDbConfigured, logLoadError } from "@/lib/queries";
import { getRole } from "@/lib/role";

export default async function ReviewPage({ params, searchParams }: PageProps<"/deals/[id]/review">) {
  const { id } = await params;
  const { m } = await searchParams;
  const role = await getRole();
  let deal;
  try {
    deal = await getDealDetail(id);
  } catch (error) {
    logLoadError("review page", error);
    return <LoadError what="this review" setup={!isDbConfigured()} />;
  }
  if (!deal) notFound();
  return <ReviewView deal={deal} role={role} milestoneId={typeof m === "string" ? m : null} />;
}
