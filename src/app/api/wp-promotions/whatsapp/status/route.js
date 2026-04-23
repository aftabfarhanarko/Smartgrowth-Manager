import { apiOk } from "@/lib/http";
import { assertTenantContext } from "@/lib/auth-context";
import { getWaStatus } from "@/lib/wp/waClient";

export async function GET(request) {
  const auth = assertTenantContext(request);
  const clientKey = auth?.context?.companyId || "default";
  const status = await getWaStatus(clientKey);
  return apiOk(status);
}

