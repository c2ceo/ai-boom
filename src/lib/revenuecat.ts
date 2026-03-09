import { Purchases, type Package } from "@revenuecat/purchases-js";
import { supabase } from "@/integrations/supabase/client";

let purchasesInstance: Purchases | null = null;

const RC_API_KEY = "rcb_xxooIHeWFLKjFnQaLytyGBCrgdjJ";

export const RC_PACKAGES = {
  AIBOOM_200_CRED: "aiboom200cred",
  AIBOOM_300_CRED: "aiboom300cred",
  AIBOOM_600_CRED: "aiboom600cred",
  AIBOOM_800_CRED: "aiboom800cred",
} as const;

export const CREDIT_PACK_META: Record<string, { credits: number; label: string }> = {
  [RC_PACKAGES.AIBOOM_200_CRED]: { credits: 200, label: "200 Credits" },
  [RC_PACKAGES.AIBOOM_300_CRED]: { credits: 300, label: "300 Credits" },
  [RC_PACKAGES.AIBOOM_600_CRED]: { credits: 600, label: "600 Credits" },
  [RC_PACKAGES.AIBOOM_800_CRED]: { credits: 800, label: "800 Credits" },
};

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

/** Fetch all credit-pack packages from the current offering */
export const fetchCreditPackages = async (): Promise<Package[]> => {
  if (!purchasesInstance) throw new Error("RevenueCat not initialized");
  const offerings = await purchasesInstance.getOfferings();
  const current = offerings.current;
  if (!current) return [];

  const validIds = Object.values(RC_PACKAGES) as string[];
  return current.availablePackages.filter((pkg) =>
    validIds.includes(pkg.identifier)
  );
};

/** Purchase a specific package */
export const purchasePackage = async (pkg: Package) => {
  if (!purchasesInstance) throw new Error("RevenueCat not initialized");
  return purchasesInstance.purchase({ rcPackage: pkg });
};

export const presentOffering = async (htmlTarget: HTMLElement): Promise<void> => {
  if (!purchasesInstance) throw new Error("RevenueCat not initialized");
  await purchasesInstance.presentPaywall({ htmlTarget });
};
