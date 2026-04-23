import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { publicPathToAbsolute } from "@/lib/email/attachmentPath";

export function createTransportFromSettings(settings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: Number(settings.port) || 587,
    secure: Boolean(settings.secure),
    auth: {
      user: settings.user,
      pass: settings.password,
    },
  });
}

export async function sendPromoEmail({
  settings,
  to,
  subject,
  text,
  html,
  attachmentPublicPath,
}) {
  const transporter = createTransportFromSettings(settings);

  const from = settings.fromName?.trim()
    ? `"${settings.fromName.trim()}" <${settings.fromEmail}>`
    : settings.fromEmail;

  const attachments = [];
  if (attachmentPublicPath) {
    const abs = publicPathToAbsolute(attachmentPublicPath);
    if (!fs.existsSync(abs)) {
      throw new Error("Attachment file not found");
    }
    attachments.push({
      filename: path.basename(abs),
      path: abs,
    });
  }

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html: html || undefined,
    attachments: attachments.length ? attachments : undefined,
  });
}
