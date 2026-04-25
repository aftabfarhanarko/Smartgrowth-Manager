import { logoutWaClient } from "@/lib/wp/waClient";
import { apiOk, apiError } from "@/lib/http";
import { assertTenantContext } from "@/lib/auth-context";

export async function POST(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);
  
  try {
    const res = await logoutWaClient(auth.context.companyId);
    return apiOk(res);
  } catch (error) {
    return apiError(error.message, 500);
  }
}
