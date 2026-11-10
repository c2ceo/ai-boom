// Existing $1 / 50-credit checkout, after the owner's 8% + $0.30 fees.
export const NET_USD_PER_CREDIT = (1 * (1 - 0.08) - 0.30) / 50;
export const REVENUE_MULTIPLE = 3.2;
export function creditsForCost(costUsd: number): number {
  return Math.ceil(Number((costUsd * REVENUE_MULTIPLE / NET_USD_PER_CREDIT).toFixed(10)));
}
export const GUEST_PUBLISH_MESSAGE = 'To retry or change a prompt while on a guest account, first publish the image you created.';