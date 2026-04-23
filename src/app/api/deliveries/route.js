import connectDB from "@/lib/mongodb";
import Delivery from "@/models/Delivery";    
import "@/models/Order";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";

export async function GET(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  await connectDB();
  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "order_system",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const deliveries = await Delivery.find({
    companyId: auth.context.companyId,
  })
    .populate("orderId")
    .sort({ createdAt: -1 });

  return apiOk(deliveries);
}
