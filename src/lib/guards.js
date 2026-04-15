import Subscription from "@/models/Subscription";
import "@/models/Package";
import Usage from "@/models/Usage";
import { LIMIT_TO_USAGE_KEY } from "@/lib/constants";
import { ensureUsageRow, getCurrentUsageMonth } from "@/lib/usage";

export async function assertSubscriptionAccess({
  companyId,
  featureKey,
  limitKey,
  incrementBy = 0,
}) {
  const subscription = await Subscription.findOne({
    companyId,
    status: "active",
  }).populate("packageId");

  if (!subscription || !subscription.packageId) {
    return { error: "No active subscription found", status: 403 };
  }

  if (new Date(subscription.expiresAt).getTime() < Date.now()) {
    await Subscription.updateOne({ _id: subscription._id }, { status: "expired" });
    return { error: "Subscription expired", status: 403 };
  }

  const pkg = subscription.packageId;

  if (featureKey && !pkg.features?.[featureKey]) {
    return { error: `Feature '${featureKey}' is not enabled`, status: 403 };
  }

  if (limitKey) {
    const usageKey = LIMIT_TO_USAGE_KEY[limitKey];
    const monthlyLimit = pkg.limits?.[limitKey] ?? 0;

    if (!usageKey) {
      return { error: `Unsupported limit key '${limitKey}'`, status: 500 };
    }

    const month = getCurrentUsageMonth();
    let usage = await Usage.findOne({ companyId, month });
    if (!usage) {
      usage = await ensureUsageRow(companyId, month);
    }

    const currentValue = usage?.[usageKey] ?? 0;
    const nextValue = currentValue + incrementBy;

    if (monthlyLimit >= 0 && nextValue > monthlyLimit) {
      return {
        error: `Usage limit exceeded for '${limitKey}'`,
        status: 429,
        meta: { currentValue, monthlyLimit },
      };
    }
  }

  return { subscription, packageDoc: pkg };
}
