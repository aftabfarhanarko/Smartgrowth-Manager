import connectDB from "./mongodb";
import Package from "../models/Package";

export async function getPackages({ activeOnly = false } = {}) {
  await connectDB();

  const query = activeOnly ? { isActive: true } : {};
  return Package.find(query).sort({ createdAt: -1 }).lean();
}

export async function createPackage(payload = {}) {
  await connectDB();

  try {
    const created = await Package.create(payload);
    return { success: true, package: created.toObject() };
  } catch (error) {
    if (error?.code === 11000) {
      return { success: false, message: "Package name already exists." };
    }

    return {
      success: false,
      message: error?.message || "Failed to create package.",
    };
  }
}

export async function updatePackage(packageId, payload = {}) {
  await connectDB();

  try {
    const updated = await Package.findByIdAndUpdate(packageId, payload, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return { success: false, message: "Package not found." };
    }

    return { success: true, package: updated };
  } catch (error) {
    if (error?.code === 11000) {
      return { success: false, message: "Package name already exists." };
    }

    return {
      success: false,
      message: error?.message || "Failed to update package.",
    };
  }
}
