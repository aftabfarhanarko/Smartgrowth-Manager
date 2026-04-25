import path from "path";
import qrcode from "qrcode";
import { Client, RemoteAuth } from "whatsapp-web.js";
import { MongoStore } from "wwebjs-mongo";
import mongoose from "mongoose";
import { normalizePhoneDigits } from "@/lib/wp/phone";
import connectDB from "@/lib/mongodb";

const WA_CLIENT_ID_BASE = process.env.WA_WEB_CLIENT_ID || "default";
const WA_CHROME_EXECUTABLE_PATH = process.env.WA_CHROME_EXECUTABLE_PATH || "";

console.log(`[WA] Global check - BROWSERLESS_API_KEY exists: ${!!process.env.BROWSERLESS_API_KEY}`);

function getClientKey(rawKey) {
  const key = String(rawKey || "default").trim();
  return key || "default";
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

async function getPuppeteerConfig() {
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  console.log(`[WA] Browserless Key present: ${!!browserlessKey}`);

  // If Browserless API Key is provided, use it (Best for Vercel)
  if (browserlessKey) {
    console.log("[WA] Mode: Remote (Browserless.io)");
    return {
      browserWSEndpoint: `wss://chrome.browserless.io/?token=${browserlessKey}`,
    };
  }

  // Fallback: Use chromium-min only on Vercel if no browserless key
  if (process.env.VERCEL) {
    console.log("[WA] Mode: Local Chromium-min (Vercel)");
    try {
      const chromium = (await import("@sparticuz/chromium-min")).default;
      const puppeteer = (await import("puppeteer-core")).default;
      
      return {
        args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath("https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"),
        headless: chromium.headless,
      };
    } catch (e) {
      console.error("[WA] Failed to load chromium for Vercel:", e.message);
    }
  }

  console.log("[WA] Mode: Local Development");
  // Local development fallback
  return {
    headless: true,
    executablePath: WA_CHROME_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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

    console.log(`[WA] Initializing RemoteAuth client for key: ${clientKey}`);
    
    await connectDB();
    const store = new MongoStore({ mongoose: mongoose });
    
    const browserlessKey = process.env.BROWSERLESS_API_KEY;
    const isVercel = process.env.VERCEL === "1" || !!process.env.VERCEL;
    const isRemote = !!browserlessKey;
    const remoteDataPath = isVercel ? "/tmp" : path.join(process.cwd(), ".wwebjs_auth");
    
    // Ensure the directory exists to avoid ENOENT errors
    if (!isVercel && !isRemote) {
      const fs = await import("fs");
      if (!fs.existsSync(remoteDataPath)) {
        fs.mkdirSync(remoteDataPath, { recursive: true });
      }
    }

    console.log(`[WA] Environment: ${isVercel ? "Vercel" : "Local/Other"}`);
    console.log(`[WA] Using dataPath: ${remoteDataPath}`);

    const auth = new RemoteAuth({
      clientId: `${WA_CLIENT_ID_BASE}-${clientKey}`,
      store: store,
      backupSyncIntervalMs: 300000,
      dataPath: remoteDataPath
    });

    const puppeteerOptions = await getPuppeteerConfig();
    
    const client = new Client({
      authStrategy: auth,
      puppeteer: puppeteerOptions,
      authTimeoutMs: 60000, // Increase timeout
    });

    console.log(`[WA] Creating Client instance with RemoteAuth...`);
    state.client = client;

    client.on("qr", async (qr) => {
      console.log(`[WA] QR received for ${clientKey}`);
      try {
        state.lastQrDataUrl = await qrcode.toDataURL(qr);
        state.lastQrAt = new Date();
      } catch (e) {
        console.error(`[WA] QR processing error:`, e);
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

    client.on("remote_session_saved", () => {
      console.log(`[WA] Remote session saved for ${clientKey}`);
    });

    client.on("auth_failure", (msg) => {
      state.connected = false;
      state.lastError = `auth_failure: ${msg || "unknown"}`;
      state.rejectReady?.(new Error(state.lastError));
    });

    client.on("disconnected", (reason) => {
      console.log(`[WA] Client disconnected: ${reason}`);
      state.connected = false;
      state.lastError = `disconnected: ${reason || "unknown"}`;
      state.lastQrDataUrl = "";
      state.lastQrAt = null;
      state.client = null;
      state.initPromise = null;
    });

    client.initialize().catch((e) => {
      const msg = e?.message || "WhatsApp initialization failed";
      console.error(`[WA] Initialization catch error for ${clientKey}:`, msg);
      state.connected = false;
      state.lastError = msg;
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
        new Promise((_, reject) => setTimeout(() => reject(new Error("WhatsApp not connected yet")), 30000)),
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

