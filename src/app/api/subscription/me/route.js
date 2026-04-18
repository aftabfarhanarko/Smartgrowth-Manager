import connectDB from "@/lib/mongodb";
import Subscription from "@/models/Subscription";
import { assertTenantContext } from "@/lib/auth-context";
import { apiError, apiOk } from "@/lib/http";

export async function GET(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  await connectDB();
  const subscription = await Subscription.findOne({
    companyId: auth.context.companyId,
    status: "active",
  }).populate("packageId");

  if (!subscription) {
    return apiError("No active subscription", 404);
  }

  return apiOk(subscription);
}
