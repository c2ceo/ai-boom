import { Purchases } from "@revenuecat/purchases-js";
import { supabase } from "@/integrations/supabase/client";

let purchasesInstance: Purchases | null = null;

const RC_API_KEY = "YOUR_REVENUECAT_PUBLIC_API_KEY"; // Replace with your RevenueCat Web public API key

export const initRevenueCat = (appUserId: string): Purchases => {
  if (purchasesInstance) return purchasesInstance;
  purchasesInstance = Purchases.configure(RC_API_KEY, appUserId);
  return purchasesInstance;
};

export const getRevenueCat = (): Purchases | null => purchasesInstance;

export const checkEntitlement = async (entitlementId: string = "AI-BOOM"): Promise<boolean> => {
  if (!purchasesInstance) return false;
  try {
    const customerInfo = await purchasesInstance.getCustomerInfo();
    return entitlementId in (customerInfo.entitlements.active ?? {});
  } catch {
    return false;
  }
};

/** Check subscription status from the database (populated by webhook) */
export const checkSubscriptionFromDB = async (userId: string): Promise<boolean> => {
  const { data } = await supabase
    .from("subscriptions")
    .select("is_active")
    .eq("user_id", userId)
    .eq("entitlement", "AI-BOOM")
    .maybeSingle();
  return data?.is_active ?? false;
};

export const presentOffering = async (htmlTarget: HTMLElement): Promise<void> => {
  if (!purchasesInstance) throw new Error("RevenueCat not initialized");
  await purchasesInstance.presentPaywall({ htmlTarget });
};
