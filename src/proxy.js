import { NextResponse } from "next/server";

const PUBLIC_API_PREFIXES = [
  "/api/health",
  "/api/packages",
  "/api/companies",
  "/api/auth",
  "/api/super-admin",
  "/api/forms",
];

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(`${normalized}${padding}`);
}

function getCompanyIdFromSessionCookie(request) {
  const token = request.cookies.get("smart_delivery_session")?.value;
  if (!token) return null;

  const [encodedPayload] = token.split(".");
  if (!encodedPayload) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload));
    return typeof payload?.companyId === "string" ? payload.companyId : null;
  } catch {
    return null;
  }
}

function getSessionPayload(request) {
  const token = request.cookies.get("smart_delivery_session")?.value;
  if (!token) return null;

  const [encodedPayload] = token.split(".");
  if (!encodedPayload) return null;

  try {
    return JSON.parse(decodeBase64Url(encodedPayload));
  } catch {
    return null;
  }
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const isPublicApi = PUBLIC_API_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!pathname.startsWith("/api/") || isPublicApi) {
    return NextResponse.next();
  }

  const session = getSessionPayload(request);
  const sessionCompanyId = getCompanyIdFromSessionCookie(request);
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
