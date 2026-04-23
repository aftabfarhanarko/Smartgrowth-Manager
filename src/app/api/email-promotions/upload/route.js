import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import connectDB from "@/lib/mongodb";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { apiError, apiOk } from "@/lib/http";

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  await connectDB();

  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "email_marketing",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Invalid form data", 400);
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return apiError('Expected multipart field "file"', 400);
  }

  const type = file.type || "";
  if (type && type !== "application/pdf") {
    return apiError("Only PDF files are allowed", 400);
  }

  const size = file.size ?? 0;
  if (size > MAX_BYTES) {
    return apiError("PDF too large (max 15MB)", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    return apiError("PDF too large (max 15MB)", 400);
  }

  if (buffer.slice(0, 4).toString() !== "%PDF") {
    return apiError("Invalid PDF file", 400);
  }

  const companyId = String(auth.context.companyId);
  const dir = path.join(process.cwd(), "public", "uploads", "email-promotions", companyId);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.pdf`;
  const absolutePath = path.join(dir, filename);
  await writeFile(absolutePath, buffer);

  const publicPath = `/uploads/email-promotions/${companyId}/${filename}`;
  return apiOk({ publicPath, filename });
}
