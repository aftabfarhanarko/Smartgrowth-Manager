import connectDB from "@/lib/mongodb";
import Order from "@/models/Order";
import Delivery from "@/models/Delivery";
import { assertTenantContext } from "@/lib/auth-context";
import { assertSubscriptionAccess } from "@/lib/guards";
import { incrementUsage } from "@/lib/usage";
import { apiError, apiOk } from "@/lib/http";

const FIELD_CANDIDATES = {
  orderNumber: ["ordernumber", "order_no", "orderno", "orderid", "invoice", "invoiceno", "id"],
  customerName: ["customername", "name", "recipientname", "customer", "username", "user"],
  customerPhone: [
    "customerphone",
    "phone",
    "mobile",
    "mobilenumber",
    "contact",
    "recipientphone",
  ],
  customerAddress: ["customeraddress", "address", "fulladdress", "deliveryaddress", "recipientaddress"],
  codAmount: [
    "codamount",
    "cod",
    "amount",
    "collectableamount",
    "cashondelivery",
    "price",
    "total",
  ],
  notes: ["notes", "note", "comment", "remarks", "instruction", "others", "paymenttype", "couponcode"],
  orderItems: ["orderitems", "items", "products"],
  orderDate: ["orderdate", "date"],
};

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseAmount(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return Number(value);
}

function pickMappedValue(row, keys) {
  const entry = Object.entries(row || {}).find(([key]) => keys.includes(normalizeKey(key)));
  return entry ? entry[1] : undefined;
}

function normalizeOrderRow(row) {
  const order = {
    orderNumber: pickMappedValue(row, FIELD_CANDIDATES.orderNumber),
    customerName: pickMappedValue(row, FIELD_CANDIDATES.customerName),
    customerPhone: pickMappedValue(row, FIELD_CANDIDATES.customerPhone),
    customerAddress: pickMappedValue(row, FIELD_CANDIDATES.customerAddress),
    codAmount: pickMappedValue(row, FIELD_CANDIDATES.codAmount),
    notes: pickMappedValue(row, FIELD_CANDIDATES.notes),
    orderItemsRaw: pickMappedValue(row, FIELD_CANDIDATES.orderItems),
    orderDateRaw: pickMappedValue(row, FIELD_CANDIDATES.orderDate),
  };

  const notesParts = [order.notes];
  const paymentType = pickMappedValue(row, ["paymenttype"]);
  const couponCode = pickMappedValue(row, ["couponcode"]);
  const discount = pickMappedValue(row, ["discount"]);
  const shipping = pickMappedValue(row, ["shipping"]);
  const orderStatus = pickMappedValue(row, ["orderstatus", "status"]);
  const orderDate = order.orderDateRaw;

  if (paymentType) notesParts.push(`Payment: ${paymentType}`);
  if (couponCode) notesParts.push(`Coupon: ${couponCode}`);
  if (discount !== undefined && discount !== "") notesParts.push(`Discount: ${discount}`);
  if (shipping !== undefined && shipping !== "") notesParts.push(`Shipping: ${shipping}`);
  if (orderStatus) notesParts.push(`Status: ${orderStatus}`);
  if (orderDate) notesParts.push(`Order Date: ${orderDate}`);
  if (order.orderItemsRaw) notesParts.push(`OrderItems: ${order.orderItemsRaw}`);

  return {
    orderNumber: String(order.orderNumber || "").trim(),
    customerName: String(order.customerName || "").trim(),
    customerPhone: String(order.customerPhone || "").trim(),
    customerAddress: String(order.customerAddress || "").trim(),
    codAmount: parseAmount(order.codAmount),
    notes: notesParts
      .filter((part) => part !== undefined && part !== null && String(part).trim())
      .map((part) => String(part).trim())
      .join(" | "),
  };
}

function generateOrderNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const randomPart = Math.floor(Math.random() * 90000 + 10000);
  return `ORD-${datePart}-${randomPart}`;
}

function validateOrderPayload(payload) {
  const required = ["customerName", "customerPhone", "customerAddress", "codAmount"];
  const missingField = required.find((field) => !payload?.[field] && payload?.[field] !== 0);
  if (missingField) {
    return `Missing field '${missingField}'`;
  }
  if (!Number.isFinite(payload.codAmount) || payload.codAmount < 0) {
    return "Invalid codAmount";
  }
  return null;
}

async function createOrderWithAutoNumber({ companyId, row, orderItems = [] }) {
  const hasProvidedNumber = Boolean(row.orderNumber);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = hasProvidedNumber ? row.orderNumber : generateOrderNumber();
    try {
      return await Order.create({
        companyId,
        orderNumber,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        customerAddress: row.customerAddress,
        codAmount: row.codAmount,
        orderItems,
        notes: row.notes || "",
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      if (hasProvidedNumber) throw error;
    }
  }

  throw new Error("Failed to generate unique order number");
}

export async function GET(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  await connectDB();
  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "order_system",
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const orders = await Order.find({ companyId: auth.context.companyId }).sort({
    createdAt: -1,
  });
  return apiOk(orders);
}

export async function POST(request) {
  const auth = assertTenantContext(request);
  if (auth.error) return apiError(auth.error, auth.status);

  const body = await request.json();
  if (body?.orderItems && !Array.isArray(body.orderItems)) {
    return apiError("orderItems must be an array", 400);
  }

  const incomingRows = Array.isArray(body) ? body : Array.isArray(body?.orders) ? body.orders : null;

  if (incomingRows) {
    if (incomingRows.length === 0) return apiError("No rows found for bulk upload", 400);

    const normalizedRows = incomingRows.map((row) => normalizeOrderRow(row));
    const validationErrors = normalizedRows
      .map((row, index) => {
        const error = validateOrderPayload(row);
        return error ? `Row ${index + 1}: ${error}` : null;
      })
      .filter(Boolean);

    if (validationErrors.length) {
      return apiError(validationErrors.slice(0, 10).join(", "), 400);
    }

    await connectDB();
    const access = await assertSubscriptionAccess({
      companyId: auth.context.companyId,
      featureKey: "order_system",
      limitKey: "orders_per_month",
      incrementBy: normalizedRows.length,
    });
    if (access.error) return apiError(access.error, access.status, access.meta);

    const createdOrders = [];
    const failedRows = [];

    for (let index = 0; index < normalizedRows.length; index += 1) {
      const row = normalizedRows[index];
      try {
        const order = await createOrderWithAutoNumber({
          companyId: auth.context.companyId,
          row,
        });

        await Delivery.create({
          companyId: auth.context.companyId,
          orderId: order._id,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerAddress: order.customerAddress,
          codAmount: order.codAmount,
          status: "pending",
        });

        createdOrders.push(order);
      } catch (error) {
        failedRows.push({
          row: index + 1,
          orderNumber: row.orderNumber,
          error: error?.code === 11000 ? "Duplicate order number" : "Failed to create order",
        });
      }
    }

    if (createdOrders.length > 0) {
      await incrementUsage(auth.context.companyId, "orders", createdOrders.length);
    }

    return apiOk(
      {
        createdCount: createdOrders.length,
        failedCount: failedRows.length,
        failedRows,
        orders: createdOrders,
      },
      201
    );
  }

  const normalizedSingle = normalizeOrderRow(body);
  const validationError = validateOrderPayload(normalizedSingle);
  if (validationError) return apiError(validationError, 400);

  const orderItems = Array.isArray(body?.orderItems)
    ? body.orderItems
        .filter((item) => item && item.name)
        .map((item) => ({
          name: String(item.name).trim(),
          quantity: Math.max(1, Number(item.quantity || 1)),
          price: Math.max(0, Number(item.price || 0)),
        }))
    : [];

  await connectDB();
  const access = await assertSubscriptionAccess({
    companyId: auth.context.companyId,
    featureKey: "order_system",
    limitKey: "orders_per_month",
    incrementBy: 1,
  });
  if (access.error) return apiError(access.error, access.status, access.meta);

  const order = await createOrderWithAutoNumber({
    companyId: auth.context.companyId,
    row: normalizedSingle,
    orderItems,
  });

  await Delivery.create({
    companyId: auth.context.companyId,
    orderId: order._id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    codAmount: order.codAmount,
    status: "pending",
  });

  await incrementUsage(auth.context.companyId, "orders", 1);
  return apiOk(order, 201);
}
