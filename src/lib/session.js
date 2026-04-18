import crypto from "crypto";

const SESSION_COOKIE_NAME = "smart_delivery_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-this";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(data) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
}

export function createSessionToken(payload) {
  const enriched = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = toBase64Url(JSON.stringify(enriched));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function parseSessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encoded));
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return parseSessionToken(token);
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}
