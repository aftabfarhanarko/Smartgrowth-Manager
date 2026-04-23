import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import CourierSetting from "@/models/CourierSetting";
import { assertTenantContext } from "@/lib/auth-context";
import { COURIER_TYPES } from "@/lib/constants";
import { apiError, apiOk } from "@/lib/http";

export async function GET(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  await connectDB();
  const settings = await CourierSetting.find({
    companyId: auth.context.companyId,
  }).sort({ courierType: 1 });

  return apiOk(settings);
}

export async function PATCH(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const body = await request.json();
  const {
    id,
    courierType,
    apiKey,
    secretKey,
    baseUrl,
    isActive,
    isDefault,
  } = body;

  if (!COURIER_TYPES.includes(courierType)) {
    return apiError("Invalid courier type", 400);
  }
  if (!apiKey || !secretKey || !baseUrl) {
    return apiError("apiKey, secretKey and baseUrl are required", 400);
  }
  await connectDB();
  if (isDefault) {
    await CourierSetting.updateMany(
      { companyId: auth.context.companyId },
      {
        $set: {
          isDefault: false,
        },
      }
    );
  }

  const updatePayload = {
    apiKey,
    secretKey,
    baseUrl,
    isActive: Boolean(isActive),
    isDefault: Boolean(isDefault),
    courierType,
  };

  let setting;
  if (id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError("Invalid courier setting id", 400);
    }

    setting = await CourierSetting.findOneAndUpdate(
      { _id: id, companyId: auth.context.companyId },
      { $set: updatePayload },
      { new: true }
    );
    if (!setting) {
      return apiError("Courier setting not found", 404);
    }
  } else {
    setting = await CourierSetting.findOneAndUpdate(
      { companyId: auth.context.companyId, courierType },
      { $set: updatePayload },
      { new: true, upsert: true }
    );
  }

  return apiOk(setting);
}

export const PUT = PATCH;
