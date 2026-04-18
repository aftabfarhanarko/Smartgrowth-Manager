import connectDB from "@/lib/mongodb";
import Delivery from "@/models/Delivery";
import CourierSetting from "@/models/CourierSetting";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { incrementUsage } from "@/lib/usage";
import { sendCourierOrder } from "@/lib/courier";
import { COURIER_TYPES } from "@/lib/constants";
import { apiError, apiOk } from "@/lib/http";

export async function POST(request, { params }) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const { id } = await params;
  const body = await request.json();
  const courierType = body?.courierType;

  if (!COURIER_TYPES.includes(courierType)) {
    return apiError("Invalid courier type", 400);
  }

  await connectDB();
  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "courier_system",
    limitKey: "courier_orders_per_month",
    incrementBy: 1,
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const delivery = await Delivery.findOne({
    _id: id,
    companyId: auth.context.companyId,
  });
  if (!delivery) return apiError("Delivery not found", 404);

  const courierConfig = await CourierSetting.findOne({
    companyId: auth.context.companyId,
    courierType,
    isActive: true,
  });
  if (!courierConfig) {
    return apiError("Active courier settings not found", 404);
  }

  try {
    const sendResult = await sendCourierOrder({
      courierType,
      config: courierConfig,
      delivery,
    });

    if (!sendResult.trackingId) {
      return apiError("Courier response missing tracking id", 502, {
        courierResponse: sendResult.raw,
      });
    }

    delivery.status = "sent";
    delivery.courierType = courierType;
    delivery.trackingId = String(sendResult.trackingId);
    delivery.courierResponse = sendResult.raw;
    await delivery.save();

    await incrementUsage(auth.context.companyId, "courierOrders", 1);
    return apiOk(delivery);
  } catch (error) {
    delivery.status = "failed";
    delivery.courierType = courierType;
    delivery.courierResponse = { error: error.message };
    await delivery.save();

    return apiError(error.message || "Courier send failed", 502);
  }
}
