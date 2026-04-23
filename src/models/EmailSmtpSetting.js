import mongoose from "mongoose";

const emailSmtpSettingSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
      index: true,
    },
    host: { type: String, required: true, trim: true },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    fromEmail: { type: String, required: true, trim: true, lowercase: true },
    fromName: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export default mongoose.models.EmailSmtpSetting || mongoose.model("EmailSmtpSetting", emailSmtpSettingSchema);
