import mongoose from "mongoose";
import { COURIER_TYPES } from "@/lib/constants";

const courierSettingSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    courierType: { type: String, enum: COURIER_TYPES, required: true },
    apiKey: { type: String, required: true, trim: true },
    secretKey: { type: String, required: true, trim: true },
    baseUrl: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

courierSettingSchema.index({ companyId: 1, courierType: 1 }, { unique: true });

export default mongoose.models.CourierSetting ||
  mongoose.model("CourierSetting", courierSettingSchema);
