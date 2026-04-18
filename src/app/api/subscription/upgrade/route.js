import connectDB from "@/lib/mongodb";
import { assertTenantContext } from "@/lib/auth-context";
import { apiError, apiOk } from "@/lib/http";
import Subscription from "@/models/Subscription";
import Package from "@/models/Package";

function getExpiryDate(startDate, billingType) {
  const days = billingType === "yearly" ? 365 : 30;
  return new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function POST(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const body = await request.json();
  const packageId = body?.packageId;

  if (!packageId) {
    return apiError("Package is required", 400);
  }

  await connectDB();

  const packageDoc = await Package.findOne({ _id: packageId, isActive: true });
  if (!packageDoc) {
    return apiError("Selected package is not available", 404);
  }

  const activeSubscription = await Subscription.findOne({
    companyId: auth.context.companyId,
    status: "active",
  }).sort({ createdAt: -1 });

  if (!activeSubscription) {
    return apiError("No active subscription found", 404);
  }

  if (String(activeSubscription.packageId) === String(packageId)) {
    return apiError("You are already using this package", 409);
  }

  const existingPendingRequest = await Subscription.findOne({
    companyId: auth.context.companyId,
    status: "pending",
  }).sort({ createdAt: -1 });

  if (existingPendingRequest) {
    return apiError("You already have a pending upgrade request", 409);
  }

  const billingType = activeSubscription.billingType || "monthly";
  const startsAt = new Date();
  const subscription = await Subscription.create({
    companyId: auth.context.companyId,
    packageId,
    billingType,
    startsAt,
    expiresAt: getExpiryDate(startsAt, billingType),
    status: "pending",
  });

  return apiOk(
    {
      subscriptionId: subscription._id,
      message: "Upgrade request submitted. Please wait for super admin approval.",
    },
    201
  );
}
