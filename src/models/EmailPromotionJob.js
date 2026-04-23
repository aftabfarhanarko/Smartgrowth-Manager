import mongoose from "mongoose";

const emailJobRecipientSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, required: false },
    name: { type: String, default: "" },
    email: { type: String, required: true },
  },
  { _id: false }
);

const emailJobLogSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    name: { type: String, default: "" },
    email: { type: String, required: true },
    status: { type: String, enum: ["sent", "failed"], required: true },
    error: { type: String, default: "" },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const emailPromotionJobSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    draftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmailPromotionDraft",
      required: true,
      index: true,
    },
    recipients: { type: [emailJobRecipientSchema], default: [] },
    subject: { type: String, required: true },
    bodyMode: { type: String, enum: ["text", "html"], default: "text" },
    bodyText: { type: String, required: true },
    templateLink: { type: String, default: "" },
    footerText: { type: String, default: "" },
    /** Public path under /public, e.g. /uploads/email-promotions/<companyId>/file.pdf */
    attachmentPublicPath: { type: String, default: "" },

    intervalSeconds: { type: Number, default: 5, min: 5 },
    currentIndex: { type: Number, default: 0, min: 0 },
    sentCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["running", "completed", "failed", "cancelled"],
      default: "running",
      index: true,
    },

    nextRunAt: { type: Date, default: null },
    lastRunAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    sendLogs: { type: [emailJobLogSchema], default: [] },
  },
  { timestamps: true }
);

emailPromotionJobSchema.index({ companyId: 1, status: 1, createdAt: -1 });

export default mongoose.models.EmailPromotionJob || mongoose.model("EmailPromotionJob", emailPromotionJobSchema);
