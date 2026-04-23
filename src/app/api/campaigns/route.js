import connectDB from "@/lib/mongodb";
import Campaign from "@/models/Campaign";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { incrementUsage } from "@/lib/usage";
import { apiError, apiOk } from "@/lib/http";
import { randomBytes } from "crypto";

function normalizeFields(fields = []) {
  return fields
    .map((field, index) => {
      const label = String(field?.label || "").trim();
      const key =
        String(field?.key || "")
          .trim()
          .replace(/[^a-zA-Z0-9_]/g, "_")
          .replace(/_+/g, "_")
          .toLowerCase() ||
        `field_${index + 1}`;
      const type = String(field?.type || "text");
      const options = Array.isArray(field?.options)
        ? field.options
          .map((option) => String(option || "").trim())
          .filter(Boolean)
        : [];

      return {
        key,
        label,
        type,
        required: Boolean(field?.required),
        options,
      };
    })
    .filter((field) => field.label);
}

function makeSlugBase(name = "") {
  return (
    String(name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "form"
  );
}

async function makeUniqueCampaignSlug(rawSource) {
  const base = makeSlugBase(rawSource);
  let slug = base;
  let attempts = 0;

  while ((await Campaign.exists({ slug })) && attempts < 8) {
    slug = `${base}-${Math.random().toString(36).slice(2, 8)}`;
    attempts += 1;
  }

  return slug;
}

async function makeUniquePublicToken() {
  let token = "";
  let attempts = 0;

  while (attempts < 10) {
    token = randomBytes(9).toString("base64url");
    const exists = await Campaign.exists({ publicToken: token });
    if (!exists) return token;
    attempts += 1;
  }

  return `${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
}

function sanitizeHexColor(value, fallback) {
  const color = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return fallback;
}

function normalizeRedirectUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) return raw;
    return parsed.toString();
  } catch {
    return raw;
  }
}

function normalizeDesign(design) {
  return {
    brandColor: sanitizeHexColor(design?.brandColor, "#18181b"),
    pageBgColor: sanitizeHexColor(design?.pageBgColor, "#f4f4f5"),
    cardBgColor: sanitizeHexColor(design?.cardBgColor, "#ffffff"),
    titleColor: sanitizeHexColor(design?.titleColor, "#18181b"),
    descriptionColor: sanitizeHexColor(design?.descriptionColor, "#71717a"),
    inputBgColor: sanitizeHexColor(design?.inputBgColor, "#ffffff"),
    inputBorderColor: sanitizeHexColor(design?.inputBorderColor, "#e4e4e7"),
    buttonTextColor: sanitizeHexColor(design?.buttonTextColor, "#ffffff"),
    borderRadius: Number.isInteger(design?.borderRadius) ? design.borderRadius : 12,
    headerImageUrl: String(design?.headerImageUrl || "").trim(),
    fontFamily: String(design?.fontFamily || "Inter").trim().slice(0, 40) || "Inter",
    submitButtonText: String(design?.submitButtonText || "Submit").trim().slice(0, 60) || "Submit",
    successMessage:
      String(design?.successMessage || "Thank you! Your response has been submitted.")
        .trim()
        .slice(0, 240) || "Thank you! Your response has been submitted.",
  };
}

export async function GET(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  await connectDB();
  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "email_marketing",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const campaigns = await Campaign.find({ companyId: auth.context.companyId }).sort({ createdAt: -1 });
  return apiOk(campaigns);
}

export async function POST(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const body = await request.json();

  console.log(body);
  const name = String(body?.name || "").trim();
  const description = String(body?.description || "").trim();
  const status = ["draft", "active", "closed"].includes(body?.status) ? body.status : "active";
  const fields = normalizeFields(body?.fields || []);
  const design = normalizeDesign(body?.design || {});
  const redirectUrl = normalizeRedirectUrl(body?.redirectUrl || "");
  if (!name) return apiError("Campaign name is required", 400);
  if (!fields.length) return apiError("At least one form field is required", 400);

  await connectDB();
  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "email_marketing",
    limitKey: "campaigns_per_month",
    incrementBy: 1,
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const slug = await makeUniqueCampaignSlug(name);
  const publicToken = await makeUniquePublicToken();
  const campaign = await Campaign.create({
    companyId: auth.context.companyId,
    name,
    description,
    status,
    fields,
    slug,
    publicToken,
    redirectUrl,
    design,
  });

  await incrementUsage(auth.context.companyId, "campaigns", 1);
  return apiOk(campaign, 201);
}
