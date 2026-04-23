<<<<<<< HEAD
import { NextResponse } from "next/server";
=======
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Company from "@/models/Company";
>>>>>>> master
import { getSessionFromRequest } from "@/lib/session";

export async function GET(request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

<<<<<<< HEAD
=======
  let company = null;
  if (mongoose.Types.ObjectId.isValid(session.companyId)) {
    await connectDB();
    company = await Company.findById(session.companyId).select("name slug").lean();
  }

>>>>>>> master
  return NextResponse.json({
    success: true,
    data: {
      userId: session.userId,
      companyId: session.companyId,
      role: session.userRole,
      name: session.name,
      email: session.email,
<<<<<<< HEAD
=======
      company: company ? { name: company.name, slug: company.slug } : null,
>>>>>>> master
    },
  });
}
