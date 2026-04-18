import mongoose from "mongoose";
import { getSessionFromRequest } from "@/lib/session";

export function getRequestContext(request) {
  const session = getSessionFromRequest(request);
  const companyId = session?.companyId || null;
  const userId = session?.userId || null;
  const userRole = session?.userRole || null;
  const headerCompanyId = request.headers.get("x-company-id") || null;

  return {
    hasSession: Boolean(session),
    companyId,
    userId,
    userRole,
    headerCompanyId,
  };
}

export function assertTenantContext(request) {
  const context = getRequestContext(request);
  if (!context.hasSession) {
    return { error: "Authentication required", status: 401 };
  }

  if (context.headerCompanyId && context.headerCompanyId !== context.companyId) {
    return { error: "Invalid tenant scope", status: 403 };
  }

  if (!context.companyId || !mongoose.Types.ObjectId.isValid(context.companyId)) {
    return { error: "Missing or invalid company context", status: 401 };
  }

  return { context };
}
