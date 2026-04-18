import mongoose from "mongoose";

const wpRecipientSchema = new mongoose.Schema(
  {
    // Excel/bulk import এ leadId থাকবে না, তাই optional রাখছি।
    leadId: { type: mongoose.Schema.Types.ObjectId, required: false },
    name: { type: String, default: "" },
    phone: { type: String, required: true },
  },
  { _id: false }
);

const wpPromotionDraftSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: false,
      index: true,
    },
    recipients: { type: [wpRecipientSchema], default: [] },
  },
  { timestamps: true }
);

wpPromotionDraftSchema.index({ companyId: 1, createdAt: -1 });

export default mongoose.models.WpPromotionDraft || mongoose.model("WpPromotionDraft", wpPromotionDraftSchema);

