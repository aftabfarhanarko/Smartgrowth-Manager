import connectDB from "@/lib/mongodb";
import Subscription from "@/models/Subscription";
import { apiError, apiOk } from "@/lib/http";
import { isSuperAdminRequest } from "@/lib/super-admin";

function getExpiryDate(startDate, billingType) {
  const days = billingType === "yearly" ? 365 : 30;
  return new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function POST(request, { params }) {
  if (!isSuperAdminRequest(request)) {
    return apiError("Superadmin access required.", 403);
  }

  await connectDB();
  const { id } = await params;

  const subscription = await Subscription.findById(id);
  if (!subscription) {
    return apiError("Subscription not found", 404);
  }

  if (subscription.status === "active") {
    return apiError("Subscription already active", 400);
  }

  await Subscription.updateMany(
    {
      companyId: subscription.companyId,
      status: "active",
      _id: { $ne: subscription._id },
    },
    { status: "cancelled" }
  );

  const startsAt = new Date();
  subscription.status = "active";
  subscription.startsAt = startsAt;
  subscription.expiresAt = getExpiryDate(startsAt, subscription.billingType);
  await subscription.save();

  return apiOk(subscription);
}
