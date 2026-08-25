import { createDeposit } from "@/lib/exchange/store";
import { validateDepositRequest } from "@/lib/exchange/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "请提交有效的 JSON 请求。" }, { status: 400 });
  }

  const result = validateDepositRequest(payload);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ transaction: createDeposit(result.data) }, { status: 201 });
}
