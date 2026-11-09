import { describe, it, expect } from "vitest";
import { CREDIT_PACK, validateCreditPayment } from "../../supabase/functions/_shared/credit-pack";

describe("Stripe credit pack", () => {
  it("sells 50 credits", () => expect(CREDIT_PACK.credits).toBe(50));
  it("charges $1 in cents", () => expect(CREDIT_PACK.amount).toBe(100));
  const paid = { payment_status: "paid", mode: "payment", metadata: { user_id: "buyer", credit_amount: "50" } };
  it("fulfills 50 paid credits", () => expect(validateCreditPayment(paid, "buyer")).toBe(50));
  it("rejects unpaid sessions", () => expect(() => validateCreditPayment({ ...paid, payment_status: "unpaid" }, "buyer")).toThrow());
  it("rejects another buyer", () => expect(() => validateCreditPayment(paid, "other")).toThrow());
  it("rejects missing credit amounts", () => expect(() => validateCreditPayment({ ...paid, metadata: { user_id: "buyer" } }, "buyer")).toThrow());
});