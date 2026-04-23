import path from "path";

/**
 * Ensures public PDF path is under public/uploads/email-promotions/<companyId>/ (anti path-traversal).
 */
export function isSafeEmailAttachmentPath(companyId, publicPath) {
  const cid = String(companyId);
  const normalized = String(publicPath || "").trim();
  if (!normalized.startsWith("/uploads/email-promotions/")) return false;

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < 4) return false;
  if (segments[0] !== "uploads" || segments[1] !== "email-promotions") return false;
  if (segments[2] !== cid) return false;

  const fileName = segments[segments.length - 1];
  if (!/\.pdf$/i.test(fileName)) return false;

  const absoluteFile = path.resolve(process.cwd(), "public", ...segments);
  const baseDir = path.resolve(process.cwd(), "public", "uploads", "email-promotions", cid);
  const rel = path.relative(baseDir, absoluteFile);
  return Boolean(rel) && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function publicPathToAbsolute(publicPath) {
  const segments = String(publicPath || "").split("/").filter(Boolean);
  return path.join(process.cwd(), "public", ...segments);
}
