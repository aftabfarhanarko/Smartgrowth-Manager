import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

const PUBLIC_API_PREFIXES = [
  "/api/health",
  "/api/packages",
  "/api/companies",
  "/api/auth",
  "/api/super-admin",
  "/api/forms",
];

export function proxy(request) {
  const { pathname } = request.nextUrl;

  const isPublicApi = PUBLIC_API_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!pathname.startsWith("/api/") || isPublicApi) {
    return NextResponse.next();
  }

  const session = getSessionFromRequest(request);
  const sessionCompanyId = session?.companyId || null;
  const headerCompanyId = request.headers.get("x-company-id");
  if (!session || !sessionCompanyId) {
    return NextResponse.json(
      {
        success: false,
        error: "Valid login session is required for tenant-scoped endpoints",
      },
      { status: 401 }
    );
  }

  if (headerCompanyId && headerCompanyId !== sessionCompanyId) {
    return NextResponse.json(
      {
        success: false,
        error: "x-company-id does not match logged in company",
      },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
