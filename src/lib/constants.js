export const USER_ROLES = ["owner", "admin", "staff"];

export const BILLING_TYPES = ["monthly", "yearly"];

export const PACKAGE_FEATURES = [
  "order_system",
  "courier_system",
  "email_marketing",
  "wp_promotion",
];

export const COURIER_TYPES = ["steadfast"];

export const DELIVERY_STATUSES = ["pending", "sent", "failed", "cancelled"];

export const USAGE_KEYS = {
  users: "users",
  orders: "orders",
  courierOrders: "courierOrders",
  emails: "emails",
  campaigns: "campaigns",
  wpPromotions: "wpPromotions",
};

export const LIMIT_TO_USAGE_KEY = {
  users: USAGE_KEYS.users,
  orders_per_month: USAGE_KEYS.orders,
  courier_orders_per_month: USAGE_KEYS.courierOrders,
  emails_per_month: USAGE_KEYS.emails,
  campaigns_per_month: USAGE_KEYS.campaigns,
  wp_promotions_per_month: USAGE_KEYS.wpPromotions,
};
