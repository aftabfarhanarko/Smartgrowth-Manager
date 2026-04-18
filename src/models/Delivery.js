import mongoose from "mongoose";
import { COURIER_TYPES, DELIVERY_STATUSES } from "@/lib/constants";

const deliverySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    customerAddress: { type: String, required: true, trim: true },
    codAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: DELIVERY_STATUSES,
      default: "pending",
      index: true,
    },
    courierType: { type: String, enum: COURIER_TYPES, default: null },
    trackingId: { type: String, default: null },
    courierResponse: { type: Object, default: null },
  },
  { timestamps: true }
);

deliverySchema.index({ companyId: 1, orderId: 1 }, { unique: true });

export default mongoose.models.Delivery ||
  mongoose.model("Delivery", deliverySchema);
