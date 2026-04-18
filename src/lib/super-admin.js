export const SUPER_ADMIN_EMAIL = "admin@smartdelivery.com";
export const SUPER_ADMIN_PASSWORD = "123456";
export const SUPER_ADMIN_TOKEN = "hardcoded-super-admin-token";

export function isSuperAdminRequest(request) {
  return request.headers.get("x-super-admin-token") === SUPER_ADMIN_TOKEN;
}
