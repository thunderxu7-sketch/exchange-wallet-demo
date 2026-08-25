import { listTransactions } from "@/lib/exchange/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    {
      fetchedAt: new Date().toISOString(),
      transactions: listTransactions(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
