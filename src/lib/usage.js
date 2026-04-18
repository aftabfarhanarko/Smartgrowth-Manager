import Usage from "@/models/Usage";

export function getCurrentUsageMonth(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function ensureUsageRow(companyId, month = getCurrentUsageMonth()) {
  const usage = await Usage.findOneAndUpdate(
    { companyId, month },
    { $setOnInsert: { companyId, month } },
    { new: true, upsert: true }
  );

  return usage;
}

export async function incrementUsage(companyId, key, amount = 1) {
  const month = getCurrentUsageMonth();
  const usage = await Usage.findOneAndUpdate(
    { companyId, month },
    { $inc: { [key]: amount }, $setOnInsert: { companyId, month } },
    { new: true, upsert: true }
  );

  return usage;
}
