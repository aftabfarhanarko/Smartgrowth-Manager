import connectDB from "@/lib/mongodb";
import Delivery from "@/models/Delivery";
import CourierSetting from "@/models/CourierSetting";
import { assertTenantContext } from "@/lib/auth-context";
import { trackCourierOrder } from "@/lib/courier";
import { apiError, apiOk } from "@/lib/http";

export async function POST(request, { params }) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const { id } = await params;
  await connectDB();

  const delivery = await Delivery.findOne({
    _id: id,
    companyId: auth.context.companyId,
  });

  if (!delivery) return apiError("Delivery not found", 404);
  if (!delivery.courierType) return apiError("Delivery is not assigned to a courier yet", 400);

  const courierConfig = await CourierSetting.findOne({
    companyId: auth.context.companyId,
    courierType: delivery.courierType,
    isActive: true,
  });
  if (!courierConfig) {
    return apiError("Active courier settings not found", 404);
  }

  try {
    const trackingResult = await trackCourierOrder({
      courierType: delivery.courierType,
      config: courierConfig,
      delivery,
    });

    if (trackingResult?.trackingCode && trackingResult.trackingCode !== delivery.trackingId) {
      delivery.trackingId = String(trackingResult.trackingCode);
      await delivery.save();
    }

    return apiOk({
      deliveryId: delivery._id,
      courierType: delivery.courierType,
      trackingId: delivery.trackingId,
      tracking: trackingResult?.raw || null,
    });
  } catch (error) {
    return apiError(error?.message || "Failed to track delivery", 502);
  }
}
