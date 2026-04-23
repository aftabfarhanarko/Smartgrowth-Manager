import connectDB from "@/lib/mongodb";
import Campaign from "@/models/Campaign";
import { apiError, apiOk } from "@/lib/http";

export async function GET(_request, { params }) {
  const { slug } = await params;
  if (!slug) return apiError("Form slug is required", 400);

  await connectDB();
  const campaign = await Campaign.findOne({
    status: "active",
    $or: [{ publicToken: slug }, { slug }],
  })
    .select("name description slug fields status design redirectUrl")
    .lean();
  if (!campaign) return apiError("Form not found", 404);

  return apiOk(campaign);
}
