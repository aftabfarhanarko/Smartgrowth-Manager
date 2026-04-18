import mongoose from "mongoose";

const usageSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    month: { type: String, required: true, index: true },
    users: { type: Number, default: 0, min: 0 },
    orders: { type: Number, default: 0, min: 0 },
    courierOrders: { type: Number, default: 0, min: 0 },
    emails: { type: Number, default: 0, min: 0 },
    campaigns: { type: Number, default: 0, min: 0 },
    wpPromotions: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

usageSchema.index({ companyId: 1, month: 1 }, { unique: true });

export default mongoose.models.Usage || mongoose.model("Usage", usageSchema);
