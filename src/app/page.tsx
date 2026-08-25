import { connection } from "next/server";

import ExchangeDashboard from "@/components/exchange-dashboard";
import { createServerRouteSnapshot } from "@/lib/exchange/store";

export default async function Home() {
  await connection();

  return (
    <ExchangeDashboard serverSnapshot={createServerRouteSnapshot()} />
  );
}
