import { createWithdrawal } from "@/lib/exchange/store";
import { validateWithdrawalRequest } from "@/lib/exchange/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "请提交有效的 JSON 请求。" }, { status: 400 });
  }

  const result = validateWithdrawalRequest(payload);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(
    { transaction: createWithdrawal(result.data) },
    { status: 201 },
  );
}
