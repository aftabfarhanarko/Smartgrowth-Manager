import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import Company from "@/models/Company";
import User from "@/models/User";
import Package from "@/models/Package";
import Subscription from "@/models/Subscription";
import Usage from "@/models/Usage";
import { apiError, apiOk } from "@/lib/http";
import { getCurrentUsageMonth } from "@/lib/usage";

function getExpiryDate(startDate, billingType) {
  const days = billingType === "yearly" ? 365 : 30;
  return new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
}

function makeBaseSlug(name = "") {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function makeUniqueSlug(companyName) {
  const base = makeBaseSlug(companyName) || "company";
  let slug = base;
  let suffix = 1;

  while (await Company.exists({ slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}
<<<<<<< HEAD
=======

>>>>>>> master
export async function POST(request) {
  await connectDB();
  const body = await request.json();

  const { companyName, companyEmail, phone, password } = body;
  const packageId = body.packageId;
  const billingType = "monthly";

  if (!companyName || !companyEmail || !phone || !password || !packageId) {
    return apiError("Missing required fields", 400);
  }

  const packageDoc = await Package.findById(packageId);
  if (!packageDoc || !packageDoc.isActive) {
    return apiError("Package not found", 404);
  }

  const normalizedEmail = companyEmail.toLowerCase();
  const companyExists = await Company.findOne({ email: normalizedEmail });
  if (companyExists) {
    return apiError("Company already exists", 409);
  }

  const slug = await makeUniqueSlug(companyName);
  const company = await Company.create({
    name: companyName,
    slug,
    email: normalizedEmail,
    phone,
    ownerEmail: normalizedEmail,
  });

  const passwordHash = await bcrypt.hash(password, 10);
  const owner = await User.create({
    companyId: company._id,
    name: companyName,
    email: normalizedEmail,
    passwordHash,
    role: "owner",
  });

  const startsAt = new Date();
  const subscription = await Subscription.create({
    companyId: company._id,
    packageId: packageDoc._id,
    billingType,
    startsAt,
    expiresAt: getExpiryDate(startsAt, billingType),
    status: "pending",
  });

  await Usage.create({
    companyId: company._id,
    month: getCurrentUsageMonth(),
    users: 1,
  });

  return apiOk(
    {
      company,
      ownerId: owner._id,
      subscriptionId: subscription._id,
    },
    201
  );
}
