import mongoose from "mongoose";

const emailRecipientSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, required: false },
    name: { type: String, default: "" },
    email: { type: String, required: true, trim: true, lowercase: true },
  },
  { _id: false }
);

const emailPromotionDraftSchema = new mongoose.Schema(
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
    recipients: { type: [emailRecipientSchema], default: [] },
  },
  { timestamps: true }
);

emailPromotionDraftSchema.index({ companyId: 1, createdAt: -1 });

export default mongoose.models.EmailPromotionDraft || mongoose.model("EmailPromotionDraft", emailPromotionDraftSchema);
