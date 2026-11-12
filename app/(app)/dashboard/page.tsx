import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboardData, isDbConfigured, logLoadError, type DashboardData } from "@/lib/queries";
import { getRole } from "@/lib/role";

export default async function DashboardPage() {
  const role = await getRole();
  let data: DashboardData | null = null;
  try {
    data = await getDashboardData();
  } catch (error) {
    logLoadError("dashboard", error);
  }
  return <DashboardView data={data} role={role} error={!data} setup={!isDbConfigured()} />;
}
