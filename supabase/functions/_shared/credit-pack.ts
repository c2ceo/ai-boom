export const CREDIT_PACK = {
  credits: 50,
  amount: 100,
  currency: "usd",
  priceId: "price_1UZzENKmrRuzdi0WJFUfZSRJ",
} as const;

export function validateCreditPayment(session: {
  payment_status: string;
  mode: string | null;
  metadata: Record<string, string> | null;
}, userId: string) {
  if (session.payment_status !== "paid" || session.mode !== "payment") throw new Error("Payment not completed");
  if (session.metadata?.user_id !== userId) throw new Error("Payment belongs to another account");
  const amount = Number(session.metadata?.credit_amount);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 10000) throw new Error("Invalid credit amount");
  return amount;
}