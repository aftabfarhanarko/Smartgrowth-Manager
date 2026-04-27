import qrcode from "qrcode";
import { Client, RemoteAuth } from "whatsapp-web.js";
import { MongoStore } from "wwebjs-mongo";
import mongoose from "mongoose";
import path from "path";
import { normalizePhoneDigits } from "@/lib/wp/phone";
import connectDB from "@/lib/mongodb";

// Simple Schema to track connection status in DB for Vercel
const WhatsAppStatusSchema = new mongoose.Schema({
  clientId: { type: String, unique: true },
  connected: { type: Boolean, default: false },
  lastQrDataUrl: String,
  updatedAt: { type: Date, default: Date.now }
});
const WhatsAppStatus = mongoose.models.WhatsAppStatus || mongoose.model("WhatsAppStatus", WhatsAppStatusSchema);

const WA_CLIENT_ID_BASE = process.env.WA_WEB_CLIENT_ID || "default";
const WA_CHROME_EXECUTABLE_PATH = process.env.WA_CHROME_EXECUTABLE_PATH || "";

const isVercel = !!(
  process.env.VERCEL === "1" ||
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.NOW_BUILDER ||
  (typeof process.cwd === 'function' && (process.cwd().includes('/vercel') || process.cwd().includes('/var/task')))
);

function getIsVercelRuntime() {
  const isLocal = process.platform === 'darwin' || process.platform === 'win32';
  return !isLocal || !!(isVercel || process.env.VERCEL || (typeof process.cwd === 'function' && (process.cwd().includes('/vercel') || process.cwd().includes('/var/task'))));
}

console.log(`[WA] Global check - BROWSERLESS_API_KEY exists: ${!!process.env.BROWSERLESS_API_KEY}`);
console.log(`[WA] Environment check - isVercel: ${isVercel}`);

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
  const isVercelRuntime = getIsVercelRuntime();

  // 1. ALWAYS prioritize Browserless on Vercel/Production
  if (browserlessKey && isVercelRuntime) {
    console.log("[WA] Mode: Remote (Browserless.io) - Recommended for Vercel");
    return {
      browserWSEndpoint: `wss://chrome.browserless.io/?token=${browserlessKey}`,
    };
  }

  // 2. Local Development (MacOS/Windows)
  if (!isVercelRuntime) {
    console.log("[WA] Mode: Local Development (Chrome)");
    const macChromePaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome",
    ];
    const fs = await import("fs");
    let localPath = WA_CHROME_EXECUTABLE_PATH || undefined;
    if (!localPath && process.platform === "darwin") {
      for (const p of macChromePaths) {
        if (fs.existsSync(p)) {
          localPath = p;
          break;
        }
      }
    }
    return {
      headless: true,
      executablePath: localPath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    };
  }

  // 3. Fallback: Vercel Local Chromium (Brittle, but possible)
  console.log("[WA] Mode: Vercel Local Chromium (Fallback)");
  try {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const execPath = await chromium.executablePath("https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar");
    
    if (execPath) {
      const libPath = path.dirname(execPath);
      process.env.LD_LIBRARY_PATH = `${libPath}:${process.env.LD_LIBRARY_PATH || ""}`;
    }

    return {
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: execPath,
      headless: chromium.headless,
    };
  } catch (e) {
    console.error("[WA] Local chromium failed:", e.message);
    if (browserlessKey) {
      return { browserWSEndpoint: `wss://chrome.browserless.io/?token=${browserlessKey}` };
    }
  }

  return {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  };
}

export async function ensureWaClient(rawKey) {
  const { clientKey, state } = getOrCreateState(rawKey);
  
  if (state.client && state.connected) return;
  if (state.initPromise) return state.initPromise;

  state.initPromise = (async () => {
    // Double check inside the promise to prevent race conditions
    if (state.client && state.connected) return state.client;
    
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
    
    await connectDB();
    const store = new MongoStore({ mongoose: mongoose });
    
    const browserlessKey = process.env.BROWSERLESS_API_KEY;
    
    const fs = await import("fs");
    const isVercelRuntime = getIsVercelRuntime();
    let remoteDataPath = isVercelRuntime ? "/tmp/.wwebjs_auth" : path.join(process.cwd(), ".wwebjs_auth");

    // Fallback: If not explicitly Vercel but directory is not writable, use /tmp
    if (!isVercelRuntime) {
      try {
        const testDir = path.join(process.cwd(), ".wwebjs_write_test");
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
        fs.rmdirSync(testDir);
      } catch (e) {
        console.log(`[WA] Current directory not writable (${process.cwd()}), forcing /tmp/.wwebjs_auth`);
        remoteDataPath = "/tmp/.wwebjs_auth";
      }
    }
    
    console.log(`[WA] Path check - isVercelRuntime: ${isVercelRuntime}, remoteDataPath: ${remoteDataPath}, cwd: ${process.cwd()}`);
    const clientId = `${WA_CLIENT_ID_BASE}-${clientKey}`;

    let auth;
    if (isVercelRuntime || remoteDataPath.startsWith("/tmp")) {
      console.log(`[WA] Using RemoteAuth for Vercel/Serverless persistence`);
      await connectDB();
      const store = new MongoStore({ mongoose: mongoose });
      auth = new RemoteAuth({
        clientId: clientId,
        store: store,
        backupSyncIntervalMs: 60000, // Minimum allowed value is 1 minute
        dataPath: remoteDataPath
      });
      
      // Ensure temp dirs for RemoteAuth
      const tempSessionDir = path.join(remoteDataPath, `wwebjs_temp_session_${clientId}`);
      const tempDefaultDir = path.join(tempSessionDir, "Default");
      [tempSessionDir, tempDefaultDir].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      });
    } else {
      console.log(`[WA] Using LocalAuth for local development`);
      const { LocalAuth } = await import("whatsapp-web.js");
      auth = new LocalAuth({
        clientId: clientId,
        dataPath: remoteDataPath
      });
      // Explicitly ensure the session directory exists
      const sessionDir = path.join(remoteDataPath, `session-${clientId}`);
      if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
    }

    const puppeteerOptions = await getPuppeteerConfig();
    
    let puppeteerConfig = {
      ...puppeteerOptions,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    };

    // If using a remote browser (Browserless), we need to connect to it first
    if (puppeteerOptions.browserWSEndpoint) {
      console.log(`[WA] Connecting to remote browser at ${puppeteerOptions.browserWSEndpoint.split('?')[0]}...`);
      const puppeteer = await import("puppeteer-core");
      try {
        const browser = await puppeteer.connect({
          browserWSEndpoint: puppeteerOptions.browserWSEndpoint,
          defaultViewport: puppeteerOptions.defaultViewport
        });
        console.log(`[WA] Successfully connected to remote browser!`);
        puppeteerConfig.browser = browser;
        // When using an existing browser, some options aren't needed or cause errors
        delete puppeteerConfig.browserWSEndpoint;
        delete puppeteerConfig.executablePath;
        delete puppeteerConfig.args;
      } catch (err) {
        console.error(`[WA] Failed to connect to remote browser:`, err.message);
        // Fallback to local if connection fails
      }
    }

    const client = new Client({
      authStrategy: auth,
      takeoverOnConflict: true,
      takeoverTimeoutMs: 20000,
      puppeteer: puppeteerConfig,
      authTimeoutMs: 90000,
    });

    state.client = client;

    client.on("qr", async (qr) => {
      console.log(`[WA] QR received for ${clientKey}`);
      try {
        state.lastQrDataUrl = await qrcode.toDataURL(qr);
        state.lastQrAt = new Date();
      } catch (e) {
        console.error(`[WA] QR processing error:`, e);
      }
    });

    client.on("authenticated", async () => {
      console.log(`[WA] Authenticated successfully for ${clientKey}`);
      // SAVE CONNECTED STATUS IMMEDIATELY ON AUTHENTICATION
      try {
        await WhatsAppStatus.findOneAndUpdate(
          { clientId: clientId },
          { connected: true, lastQrDataUrl: "", updatedAt: new Date() },
          { upsert: true }
        );
        state.connected = true;
      } catch (e) {
        console.error(`[WA] Error saving authenticated status to DB:`, e.message);
      }
    });

    client.on("auth_failure", (msg) => {
      console.error(`[WA] Auth failure for ${clientKey}:`, msg);
      state.lastError = `Auth failure: ${msg}`;
    });

    client.on("ready", async () => {
      console.log(`[WA] Client is ready and CONNECTED for ${clientKey}`);
      state.connected = true;
      state.lastError = "";
      state.lastQrDataUrl = "";
      state.resolveReady?.();
      
      // PERSIST STATUS TO DB
      try {
        await WhatsAppStatus.findOneAndUpdate(
          { clientId: clientId },
          { connected: true, lastQrDataUrl: "", updatedAt: new Date() },
          { upsert: true }
        );
      } catch (e) {
        console.error(`[WA] Error saving status to DB:`, e.message);
      }
    });

    client.on("remote_session_saved", async () => {
      console.log(`[WA] Remote session successfully saved to MongoDB for ${clientKey}`);
    });

    client.on("disconnected", async (reason) => {
      console.log(`[WA] Client DISCONNECTED for ${clientKey}:`, reason);
      state.connected = false;
      state.client = null;
      state.initPromise = null;
      state.lastQrDataUrl = "";
      
      // UPDATE STATUS IN DB
      try {
        await WhatsAppStatus.findOneAndUpdate(
          { clientId: clientId },
          { connected: false, updatedAt: new Date() },
          { upsert: true }
        );
      } catch (e) {
        console.error(`[WA] Error updating logout status in DB:`, e.message);
      }

      if (reason !== "NAVIGATION") {
        setTimeout(() => ensureWaClient(clientKey), 5000);
      }
    });

    console.log(`[WA] Initializing client for key: ${clientKey}...`);
    try {
      await client.initialize();
      console.log(`[WA] client.initialize() call completed for ${clientKey}. Waiting for Ready...`);
      
      // On Vercel, we wait for a shorter period to avoid platform timeouts (10s limit)
      await Promise.race([
        state.readyPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("WhatsApp Ready Timeout")), 8000))
      ]);
      
      return client;
    } catch (err) {
      console.error(`[WA] Initialization error for ${clientKey}:`, err.message);
      
      // If browser is already running, we must clear state to allow a fresh start later
      state.client = null;
      state.initPromise = null;
      state.connected = false;
      
      if (err.message.includes("already running")) {
        console.log(`[WA] Attempting to force reset state due to running browser...`);
        // We set a flag to wait before next attempt
        state.lastError = "Browser conflict. Please wait or restart server.";
      }
      
      state.rejectReady?.(err);
      throw err;
    }
  })();

  return state.initPromise;
}

export async function getWaStatus(rawKey) {
  const { clientKey, state } = getOrCreateState(rawKey);
  const clientId = `${WA_CLIENT_ID_BASE}-${clientKey}`;
  
  await connectDB();
  
  try {
    // 1. Check DB first
    const dbStatus = await WhatsAppStatus.findOne({ clientId: clientId });
    if (dbStatus?.connected) {
      state.connected = true;
      // If we are in-memory connected, just return
      if (state.client) return getInitState(state);
    }

    // 2. If not in-memory or DB says disconnected, ensure client
    await ensureWaClient(rawKey);
    
    // Wait a short time for the ready event
    if (!state.connected && state.readyPromise) {
      await Promise.race([
        state.readyPromise,
        new Promise((resolve) => setTimeout(resolve, 5000))
      ]);
    }
  } catch (e) {
    console.error(`[WA] Status error for ${rawKey}:`, e.message);
    state.lastError = e?.message || "WhatsApp initialization failed";
  }
  return getInitState(state);
}

// Helper to check if client is truly ready to send
function isClientTrulyReady(client) {
  try {
    return client && client.pupPage && !client.pupPage.isClosed();
  } catch (e) {
    return false;
  }
}

export async function sendWhatsAppMessage({ phone, message, clientKey }) {
  const { state } = getOrCreateState(clientKey);
  
  try {
    await ensureWaClient(clientKey);
  } catch (err) {
    console.error(`[WA] ensureWaClient failed for ${clientKey}:`, err);
    return { queued: false, sent: false, error: "Failed to initialize WhatsApp client" };
  }

  const digits = normalizePhoneDigits(phone);
  if (!digits) {
    console.error(`[WA] Invalid phone number: ${phone}`);
    return { queued: false, sent: false, error: "Missing or invalid phone digits" };
  }

  // Wait if not connected
  if (!state.connected || !state.client) {
    console.log(`[WA] Client not connected for ${clientKey}, waiting up to 30s...`);
    try {
      await Promise.race([
        state.readyPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("WhatsApp not connected yet (timeout)")), 30000)),
      ]);
    } catch (e) {
      console.error(`[WA] Connection wait failed for ${clientKey}:`, e.message);
      return { queued: false, sent: false, error: e.message };
    }
  }

  const waChatId = `${digits}@c.us`;
  const waLink = `https://wa.me/${digits}?text=${encodeURIComponent(message || "")}`;

  console.log(`[WA] Sending message to ${waChatId}...`);
  
  // Try to send with a simple retry for detached frame errors
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      // ENSURE CLIENT AND PAGE OBJECTS ARE VALID
      if (!isClientTrulyReady(state.client)) {
        console.log(`[WA] Client or Page is null/closed, initializing...`);
        state.client = null;
        state.initPromise = null;
        await ensureWaClient(clientKey);
        
        if (!isClientTrulyReady(state.client)) {
          throw new Error("Failed to reach a ready state for WhatsApp client");
        }
      }
      
      const result = await state.client.sendMessage(waChatId, message || "");
      console.log(`[WA] Message sent successfully to ${digits}`);
      return { queued: true, sent: true, waLink, resultId: result?.id?._serialized || "" };
    } catch (err) {
      lastErr = err;
      console.error(`[WA] Send attempt ${i+1} failed for ${digits}:`, err.message);
      
      if (err.message.includes("detached Frame") || err.message.includes("Protocol error") || err.message.includes("Execution context was destroyed")) {
        console.log(`[WA] Stale browser detected, attempting to re-initialize...`);
        // Clear the state so the next attempt gets a fresh client
        state.client = null;
        state.initPromise = null;
        state.connected = false;
        
        try {
          await ensureWaClient(clientKey);
          // Wait a bit for the new client to be ready
          await new Promise(r => setTimeout(r, 2000));
        } catch (initErr) {
          console.error(`[WA] Re-initialization failed during retry:`, initErr.message);
        }
        continue;
      }
      
      // For other errors, wait a bit and retry
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return { queued: false, sent: false, error: lastErr?.message || "Failed to send message" };
}

export async function logoutWaClient(rawKey) {
  const { clientKey, state } = getOrCreateState(rawKey);
  
  console.log(`[WA] Logging out client for ${clientKey}...`);
  
  if (state.client) {
    try {
      await state.client.destroy();
    } catch (e) {
      console.error(`[WA] Error destroying client during logout:`, e.message);
    }
  }

  // Reset state
  state.client = null;
  state.initPromise = null;
  state.connected = false;
  state.lastQrDataUrl = "";
  state.lastError = "";
  
  return { success: true };
}
