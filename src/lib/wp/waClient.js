import path from "path";
import qrcode from "qrcode";
import { Client, LocalAuth } from "whatsapp-web.js";
import { normalizePhoneDigits } from "@/lib/wp/phone";

const WA_CLIENT_ID_BASE = process.env.WA_WEB_CLIENT_ID || "default";
const WA_SESSION_DIR_BASE = process.env.WA_WEB_SESSION_DIR || path.join(process.cwd(), ".wa-session");
const WA_CHROME_EXECUTABLE_PATH = process.env.WA_CHROME_EXECUTABLE_PATH || "";

function getClientKey(rawKey) {
  const key = String(rawKey || "default").trim();
  return key || "default";
}

function getSessionPathForKey(clientKey) {
  return path.join(WA_SESSION_DIR_BASE, clientKey);
}

const clients = new Map();

function getOrCreateState(rawKey) {
  const clientKey = getClientKey(rawKey);
  if (!clients.has(clientKey)) {
    clients.set(clientKey, {
      client: null,
      initPromise: null,
      connected: false,
      lastQrDataUrl: "",
      lastQrAt: null,
      lastError: "",
      readyPromise: null,
      resolveReady: null,
      rejectReady: null,
    });
  }
  return { clientKey, state: clients.get(clientKey) };
}

function getInitState(state) {
  return {
    connected: state.connected,
    lastQrDataUrl: state.lastQrDataUrl,
    lastQrAt: state.lastQrAt,
    lastError: state.lastError,
  };
}

export async function ensureWaClient(rawKey) {
  const { clientKey, state } = getOrCreateState(rawKey);
  if (state.client) return;
  if (state.initPromise) return state.initPromise;

  state.initPromise = (async () => {
    state.connected = false;
    state.lastError = "";
    state.lastQrDataUrl = "";
    state.lastQrAt = null;

    state.readyPromise = new Promise((resolve, reject) => {
      state.resolveReady = resolve;
      state.rejectReady = reject;
    });
    state.readyPromise.catch(() => {});

    console.log(`[WA] Initializing client for key: ${clientKey}`);
    const auth = new LocalAuth({
      clientId: `${WA_CLIENT_ID_BASE}-${clientKey}`,
      dataPath: getSessionPathForKey(clientKey),
    });

    const client = new Client({
      authStrategy: auth,
      puppeteer: {
        headless: true,
        executablePath: WA_CHROME_EXECUTABLE_PATH || undefined,
        args: ["--no-sandbox"],
      },
      webVersionCache: {
        type: "remote",
        remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-js/main/dist/wppconnect-wa.js",
      },
    });

    console.log(`[WA] Creating Client instance...`);
    state.client = client;

    client.on("qr", async (qr) => {
      console.log(`[WA] QR received for ${clientKey}`);
      try {
        state.lastQrDataUrl = await qrcode.toDataURL(qr);
        state.lastQrAt = new Date();
      } catch (e) {
        console.error(`[WA] QR processing error:`, e);
        state.lastQrDataUrl = "";
        state.lastQrAt = new Date();
        state.lastError = e?.message || "Failed to generate QR";
      }
    });

    client.on("ready", () => {
      console.log(`[WA] Client is ready for ${clientKey}`);
      state.connected = true;
      state.lastError = "";
      state.lastQrDataUrl = "";
      state.resolveReady?.();
    });

    client.on("auth_failure", (msg) => {
      state.connected = false;
      state.lastError = `auth_failure: ${msg || "unknown"}`;
      state.rejectReady?.(new Error(state.lastError));
    });

    client.on("disconnected", (reason) => {
      state.connected = false;
      state.lastError = `disconnected: ${reason || "unknown"}`;
      state.lastQrDataUrl = "";
      state.lastQrAt = null;
      state.readyPromise = new Promise((resolve, reject) => {
        state.resolveReady = resolve;
        state.rejectReady = reject;
      });
      state.readyPromise.catch(() => {});
    });

    client.on("change_state", () => {});

    console.log(`[WA] Calling client.initialize()...`);
    client.initialize().catch((e) => {
      const msg = e?.message || "WhatsApp initialization failed";
      console.error(`[WA] Initialization catch error for ${clientKey}:`, msg);
      state.connected = false;
      state.lastError = msg;

      // Reset state so we can try again on next call
      state.client = null;
      state.initPromise = null;

      state.rejectReady?.(new Error(state.lastError));
    });
  })();

  return state.initPromise;
}

export async function getWaStatus(rawKey) {
  const { state } = getOrCreateState(rawKey);
  try {
    await ensureWaClient(rawKey);
  } catch (e) {
    state.lastError = e?.message || "WhatsApp initialization failed";
  }
  return getInitState(state);
}

export async function sendWhatsAppMessage({ phone, message, clientKey }) {
  const { state } = getOrCreateState(clientKey);
  await ensureWaClient(clientKey);

  const digits = normalizePhoneDigits(phone);
  if (!digits) {
    return { queued: false, sent: false, error: "Missing phone digits" };
  }

  if (!state.connected) {
    try {
      await Promise.race([
        state.readyPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("WhatsApp not connected yet")), 15000)),
      ]);
    } catch (e) {
      return { queued: false, sent: false, error: e?.message || "WhatsApp not connected" };
    }
  }

  const waChatId = `${digits}@c.us`;
  const waLink = `https://wa.me/${digits}?text=${encodeURIComponent(message || "")}`;

  const result = await state.client.sendMessage(waChatId, message || "");

  return { queued: true, sent: true, waLink, resultId: result?.id?._serialized || "" };
}

