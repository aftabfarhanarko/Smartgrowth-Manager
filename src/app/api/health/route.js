import { apiOk } from "@/lib/http";

export async function GET() {
  return apiOk({ status: "ok" });
}
