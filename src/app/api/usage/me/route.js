import connectDB from "@/lib/mongodb";
import Subscription from "@/models/Subscription";
import "@/models/Package";
import Usage from "@/models/Usage";
import { assertTenantContext } from "@/lib/auth-context";
import { ensureUsageRow, getCurrentUsageMonth } from "@/lib/usage";
import { apiError, apiOk } from "@/lib/http";

export async function GET(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  await connectDB();

  const month = getCurrentUsageMonth();
  let usage = await Usage.findOne({
    companyId: auth.context.companyId,
    month,
  });
  if (!usage) {
    usage = await ensureUsageRow(auth.context.companyId, month);
  }

  const subscription = await Subscription.findOne({
    companyId: auth.context.companyId,
    status: "active",
  }).populate("packageId");

  if (!subscription || !subscription.packageId) {
    return apiError("No active subscription found", 404);
  }

  const limits = subscription.packageId?.limits || {};
  return apiOk({
    month,
    usage: {
      users: usage?.users ?? 0,
      orders: usage?.orders ?? 0,
      courierOrders: usage?.courierOrders ?? 0,
      emails: usage?.emails ?? 0,
      campaigns: usage?.campaigns ?? 0,
      wpPromotions: usage?.wpPromotions ?? 0,
    },
    limits: {
      users: limits?.users ?? 0,
      orders_per_month: limits?.orders_per_month ?? 0,
      courier_orders_per_month: limits?.courier_orders_per_month ?? 0,
      emails_per_month: limits?.emails_per_month ?? 0,
      campaigns_per_month: limits?.campaigns_per_month ?? 0,
      wp_promotions_per_month: limits?.wp_promotions_per_month ?? 0,
    },
  });
}
