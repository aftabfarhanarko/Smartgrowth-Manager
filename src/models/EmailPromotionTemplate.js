import mongoose from "mongoose";

const emailPromotionTemplateSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    bodyMode: { type: String, enum: ["text", "html"], default: "text" },
    bodyText: { type: String, required: true },
    templateLink: { type: String, default: "" },
    footerText: { type: String, default: "" },
  },
  { timestamps: true }
);

emailPromotionTemplateSchema.index({ companyId: 1, createdAt: -1 });

export default mongoose.models.EmailPromotionTemplate ||
  mongoose.model("EmailPromotionTemplate", emailPromotionTemplateSchema);
