import connectDB from "@/lib/mongodb";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { incrementUsage } from "@/lib/usage";
import { apiError, apiOk } from "@/lib/http";

export async function POST(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const body = await request.json().catch(() => ({}));
  const countRaw = body?.count ?? 1;
  const count = Number(countRaw);

  if (!Number.isFinite(count) || count < 1) {
    return apiError("count must be a positive number", 400);
  }

  await connectDB();

  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "wp_promotion",
    limitKey: "wp_promotions_per_month",
    incrementBy: count,
  });

  if (access.error) return apiError(access.error, access.status, access.meta);

  await incrementUsage(auth.context.companyId, "wpPromotions", count);

  return apiOk({ incrementedBy: count });
}

