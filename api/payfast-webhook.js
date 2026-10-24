// Minimal PayFast starter (no Blob, no Response objects) - classic Vercel (req, res) handler.
// ENV: PAYFAST_MERCHANT_ID, PAYFAST_SECURED_KEY, PAYFAST_MERCHANT_NAME, PAYFAST_ENV (sandbox|live), FALLBACK_EMAIL, SITE_URL (optional)
import crypto from "node:crypto";

const E = process.env;
const BASE = { sandbox: "https://ipguat.apps.net.pk", live: "https://ipg1.apps.net.pk" };
const TOKEN_PATH = "/Ecommerce/api/Transaction/GetAccessToken";
const POST_PATH = "/Ecommerce/api/Transaction/PostTransaction";

function send(res, status, type, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}
const sendJson = (res, o, s = 200) => send(res, s, "application/json", JSON.stringify(o));
const page = (res, b) => send(res, 200, "text/html; charset=utf-8", `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><body style="font:17px system-ui;max-width:560px;margin:24px auto;padding:0 16px">${b}`);

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
    try { return JSON.parse(String(req.body)); } catch { return {}; }
  }
  const c = []; for await (const x of req) c.push(x);
  try { return JSON.parse(Buffer.concat(c).toString() || "{}"); } catch { return {}; }
}

export default async function handler(req, res) {
  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const site = (E.SITE_URL || `https://${host}`).replace(/\/$/, "");
    const action = new URL(req.url, "https://x").searchParams.get("action");
    const base = BASE[E.PAYFAST_ENV === "live" ? "live" : "sandbox"];

    if (action === "ping")
      return sendJson(res, { ok: true, ver: 6, env: Object.fromEntries(["PAYFAST_MERCHANT_ID", "PAYFAST_SECURED_KEY", "PAYFAST_MERCHANT_NAME", "PAYFAST_ENV", "FALLBACK_EMAIL"].map((k) => [k, !!E[k]])), payfastBase: base });

    if (action === "start" && req.method === "POST") {
      const { ids, name, phone } = await readBody(req);
