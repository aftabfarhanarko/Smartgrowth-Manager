import { NextResponse } from "next/server";
import { createPackage, getPackages, updatePackage } from "../../../lib/package-store";
import { isSuperAdminRequest } from "@/lib/super-admin";

export async function GET() {
  const packages = await getPackages({ activeOnly: true });

  return NextResponse.json({
    success: true,
    packages,
  });
}

export async function POST(request) {
  if (!isSuperAdminRequest(request)) {
    return NextResponse.json(
      { success: false, message: "Superadmin access required." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const created = await createPackage(body);
  if (!created.success) {
    return NextResponse.json(
      { success: false, message: created.message },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Package created successfully.",
    package: created.package,
  });
}

export async function PUT(request) {
  if (!isSuperAdminRequest(request)) {
    return NextResponse.json(
      { success: false, message: "Superadmin access required." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const packageId = body?.packageId;

  if (!packageId) {
    return NextResponse.json(
      { success: false, message: "Package id is required." },
      { status: 400 }
    );
  }

  const updated = await updatePackage(packageId, {
    name: body?.name,
    priceMonthly: body?.priceMonthly,
    priceYearly: body?.priceYearly,
    features: body?.features,
    limits: body?.limits,
  });

  if (!updated.success) {
    return NextResponse.json(
      { success: false, message: updated.message },
      { status: updated.message === "Package not found." ? 404 : 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Package updated successfully.",
    package: updated.package,
  });
}
