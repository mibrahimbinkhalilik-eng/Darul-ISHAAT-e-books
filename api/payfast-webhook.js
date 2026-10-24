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
      const t = await (await fetch(site + "/data/catalog.js")).text();
      let cat; try { cat = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1)); } catch (e) { return sendJson(res, { error: "catalog read failed", detail: String(e.message) + " | starts: " + t.slice(0, 60) }, 502); }
      const books = (Array.isArray(ids) ? ids : []).map((i) => cat.find((b) => b.id === i)).filter(Boolean);
      if (!books.length || !name || !phone) return sendJson(res, { error: "Missing order details" }, 400);
      const amount = books.reduce((s, b) => s + b.price, 0); // price comes from the catalog, not from the browser
      const basket = "DI" + Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
      const r = await fetch(base + TOKEN_PATH, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ MERCHANT_ID: E.PAYFAST_MERCHANT_ID || "", SECURED_KEY: E.PAYFAST_SECURED_KEY || "", BASKET_ID: basket, TXNAMT: String(amount), CURRENCY_CODE: "PKR" }),
      });
      const raw = await r.text(); let tr = {}; try { tr = JSON.parse(raw); } catch {}
      if (!tr.ACCESS_TOKEN) return sendJson(res, { error: "PayFast token failed", detail: `HTTP ${r.status}: ${raw.slice(0, 200)}` }, 502);
      return sendJson(res, {
        url: base + POST_PATH,
        fields: {
          CURRENCY_CODE: "PKR", MERCHANT_ID: E.PAYFAST_MERCHANT_ID, MERCHANT_NAME: E.PAYFAST_MERCHANT_NAME || "Darul Ishaat",
          TOKEN: tr.ACCESS_TOKEN, PROCCODE: "00", TXNAMT: String(amount), CUSTOMER_MOBILE_NO: phone,
          CUSTOMER_EMAIL_ADDRESS: E.FALLBACK_EMAIL || "orders@example.com", SIGNATURE: crypto.randomBytes(8).toString("hex"),
          VERSION: "MERCHANTCART-0.1", TXNDESC: books.map((b) => b.title).join(", ").slice(0, 100),
          SUCCESS_URL: `${site}/api/payfast-webhook?action=return`, FAILURE_URL: site + "/?payment=failed", BASKET_ID: basket,
          ORDER_DATE: new Date().toISOString().slice(0, 19).replace("T", " "), CHECKOUT_URL: `${site}/api/payfast-webhook?action=ipn`, TRAN_TYPE: "ECOMM_PURCHASE",
        },
      });
    }

    if (action === "return") return page(res, "<h2>Thank you!</h2><p>If your payment went through, our representative will confirm it and send your PDF link on WhatsApp shortly.</p>");
    if (action === "ipn") return send(res, 200, "text/plain", "ok");
    return send(res, 404, "text/plain", "Not found");
  } catch (e) {
    console.error("payfast-webhook error:", e);
    try { sendJson(res, { error: "server error", detail: String((e && e.message) || e) }, 500); } catch {}
  }
}
