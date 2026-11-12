import { notFound } from "next/navigation";
import { DealView } from "@/components/deal/deal-view";
import { LoadError } from "@/components/app/load-error";
import { getDealDetail, isDbConfigured, logLoadError } from "@/lib/queries";
import { getRole } from "@/lib/role";

export default async function DealPage({ params }: PageProps<"/deals/[id]">) {
  const { id } = await params;
  const role = await getRole();
  let deal;
  try {
    deal = await getDealDetail(id);
  } catch (error) {
    logLoadError("deal page", error);
    return <LoadError what="this deal" setup={!isDbConfigured()} />;
  }
  if (!deal) notFound();
  return (
    <DealView
      deal={deal}
      role={role}
      // The PayPal client id is public by design (it is sent to the browser SDK).
      paypalClientId={process.env.PAYPAL_CLIENT_ID ?? ""}
    />
  );
}
