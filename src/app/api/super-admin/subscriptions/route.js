import connectDB from "@/lib/mongodb";
import Subscription from "@/models/Subscription";
// Ensure populate("companyId") / populate("packageId") model refs are registered.
import "@/models/Company";
import "@/models/Package";
import { apiError, apiOk } from "@/lib/http";
import { isSuperAdminRequest } from "@/lib/super-admin";

export async function GET(request) {
  if (!isSuperAdminRequest(request)) {
    return apiError("Superadmin access required.", 403);
  }

  await connectDB();
  const subscriptions = await Subscription.find({})
    .populate("companyId", "name slug email")
    .populate("packageId", "name")
    .sort({ createdAt: -1 });

  return apiOk(subscriptions);
}
