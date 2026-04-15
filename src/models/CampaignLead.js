import mongoose from "mongoose";

const campaignLeadSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    answers: { type: Object, default: {} },
    submittedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

campaignLeadSchema.index({ campaignId: 1, submittedAt: -1 });

export default mongoose.models.CampaignLead || mongoose.model("CampaignLead", campaignLeadSchema);
