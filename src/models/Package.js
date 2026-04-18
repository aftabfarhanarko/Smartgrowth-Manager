import mongoose from "mongoose";
import { PACKAGE_FEATURES } from "@/lib/constants";

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    priceMonthly: { type: Number, default: 0, min: 0 },
    priceYearly: { type: Number, default: 0, min: 0 },
    features: {
      type: Object,
      default: () =>
        PACKAGE_FEATURES.reduce((acc, feature) => {
          acc[feature] = false;
          return acc;
        }, {}),
    },
    limits: {
      users: { type: Number, default: 1, min: 1 },
      orders_per_month: { type: Number, default: 100, min: 0 },
      courier_orders_per_month: { type: Number, default: 100, min: 0 },
      emails_per_month: { type: Number, default: 0, min: 0 },
      campaigns_per_month: { type: Number, default: 0, min: 0 },
      wp_promotions_per_month: { type: Number, default: 0, min: 0 },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Package ||
  mongoose.model("Package", packageSchema);
