// ONE serverless function for the whole PayFast flow (Vercel, Node, no database):
//   POST ?action=start     website -> creates the order, gets PayFast token, returns the checkout form fields
//   GET  ?action=ipn       PayFast server -> verifies the payment hash, marks the order PAID   (PayFast "CHECKOUT_URL")
//   GET  ?action=return    customer comes back from PayFast -> page with the "Download PDF" buttons (only if PAID)
//   GET  ?action=download  streams the PDF from a PRIVATE Vercel Blob store (only if PAID and link valid)
//
// ===== SETTINGS: add these in Vercel -> Project -> Settings -> Environment Variables =====
//   PAYFAST_MERCHANT_ID    your PayFast merchant id
//   PAYFAST_SECURED_KEY    your PayFast secured key           (secret, never put it in config.js)
//   PAYFAST_MERCHANT_NAME  name shown on the PayFast page, e.g. Darul Ishaat
//   PAYFAST_ENV            "sandbox" while testing, "live" when real   (default sandbox)
//   ORDER_SECRET           any long random text (signs download links)
//   FALLBACK_EMAIL         an email of yours (PayFast asks for one; the customer form has none)
//   SITE_URL               optional, e.g. https://yourdomain.com (default: the current domain)
// Also: Vercel -> Storage -> create a PRIVATE Blob store and connect it to this project.
// Put each PDF in that store at:  pdf/<book-id>.pdf     e.g. pdf/hadis-e-qudsia.pdf
//
// ===== PAYFAST CONSTANTS - CHECK THESE AGAINST YOUR PAYFAST MERCHANT DOCUMENT =====
// I could not open PayFast's hosted-checkout document, so these are from the usual Pakistan (APPS) hosted
// checkout and MUST be confirmed in the sandbox before going live. If any is wrong, payments simply
// won't be marked PAID (the code fails closed, nobody gets a free PDF).
const PF = {
  base: { sandbox: "https://ipguat.apps.net.pk", live: "https://ipg1.apps.net.pk" },
  tokenPath: "/Ecommerce/api/Transaction/GetAccessToken",
  postPath: "/Ecommerce/api/Transaction/PostTransaction",
  okCodes: ["000", "00"],                                   // err_code values that mean "paid"
  hash: (p) => `${p.basket_id}|${p.secured_key}|${p.merchant_id}|${p.err_code}`, // validation_hash = SHA256 of this
};
const DAYS_VALID = 7; // how long the download link works after payment

import crypto from "node:crypto";
import { Readable } from "node:stream";
let _blob;
const blob = async () => (_blob ||= await import("@vercel/blob"));

const E = process.env, sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const sign = (b) => crypto.createHmac("sha256", E.ORDER_SECRET || "").update(b).digest("hex").slice(0, 32);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const html = (b) => new Response(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><body style="font:17px system-ui;max-width:560px;margin:24px auto;padding:0 16px">${b}`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
const orderPath = (b) => `orders/${b}.json`;
async function readOrder(b) {
  if (!/^DI[a-z0-9]+$/.test(b || "")) return null;
  const r = await (await blob()).get(orderPath(b), { access: "private", useCache: false }).catch(() => null);
  return r && r.statusCode === 200 ? JSON.parse(await new Response(r.stream).text()) : null;
}
const writeOrder = async (b, o) => (await blob()).put(orderPath(b), JSON.stringify(o), { access: "private", contentType: "application/json", allowOverwrite: true, addRandomSuffix: false });
async function catalog(site) {
  const t = await (await fetch(site + "/data/catalog.js")).text();
  return JSON.parse(t.slice(t.indexOf("=") + 1).trim().replace(/;$/, ""));
}

async function core(request) {
  const url = new URL(request.url), action = url.searchParams.get("action");
  const site = (E.SITE_URL || `https://${request.headers.get("host")}`).replace(/\/$/, "");
  const base = PF.base[E.PAYFAST_ENV === "live" ? "live" : "sandbox"];
  const self = `${site}/api/payfast-webhook`;

  // health check: open /api/payfast-webhook?action=ping in the browser to see what is missing (no secrets shown)
  if (action === "ping") {
    let blobOk = true; try { await blob(); } catch (e) { blobOk = String(e.message || e); }
    return json({ ok: true, ver: 3, env: Object.fromEntries(["PAYFAST_MERCHANT_ID", "PAYFAST_SECURED_KEY", "PAYFAST_MERCHANT_NAME", "PAYFAST_ENV", "ORDER_SECRET", "FALLBACK_EMAIL", "BLOB_STORE_ID", "BLOB_READ_WRITE_TOKEN"].map((k) => [k, !!E[k]])), blobPackage: blobOk, payfastBase: base });
  }

  // 1) website asks to start a payment
  if (action === "start" && request.method === "POST") {
    const { ids, name, phone } = await request.json().catch(() => ({}));
    const cat = await catalog(site), books = (ids || []).map((i) => cat.find((b) => b.id === i)).filter(Boolean);
    if (!books.length || !name || !phone) return json({ error: "Missing order details" }, 400);
    const amount = books.reduce((s, b) => s + b.price, 0);           // price is read from the site catalog, never from the browser
    const basket = "DI" + Date.now().toString(36) + crypto.randomBytes(5).toString("hex");
    await writeOrder(basket, { status: "pending", ids: books.map((b) => b.id), amount, name, phone, created: Date.now() });
    const tr = await fetch(base + PF.tokenPath, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ MERCHANT_ID: E.PAYFAST_MERCHANT_ID, SECURED_KEY: E.PAYFAST_SECURED_KEY, BASKET_ID: basket, TXNAMT: String(amount), CURRENCY_CODE: "PKR" }),
    }).then((r) => r.json()).catch(() => ({}));
    if (!tr.ACCESS_TOKEN) return json({ error: "PayFast token failed" }, 502);
    const sig = sign(basket), ret = `${self}?action=return&basket=${basket}&sig=${sig}`;
    return json({
      url: base + PF.postPath,
      fields: {
        CURRENCY_CODE: "PKR", MERCHANT_ID: E.PAYFAST_MERCHANT_ID, MERCHANT_NAME: E.PAYFAST_MERCHANT_NAME || "Darul Ishaat",
        TOKEN: tr.ACCESS_TOKEN, PROCCODE: "00", TXNAMT: String(amount), CUSTOMER_MOBILE_NO: phone,
        CUSTOMER_EMAIL_ADDRESS: E.FALLBACK_EMAIL || "orders@example.com", SIGNATURE: crypto.randomBytes(8).toString("hex"),
        VERSION: "MERCHANTCART-0.1", TXNDESC: books.map((b) => b.title).join(", ").slice(0, 100),
        SUCCESS_URL: ret, FAILURE_URL: site + "/?payment=failed", BASKET_ID: basket,
        ORDER_DATE: new Date().toISOString().slice(0, 19).replace("T", " "), CHECKOUT_URL: `${self}?action=ipn`, TRAN_TYPE: "ECOMM_PURCHASE",
      },
    });
  }

  // 2) PayFast tells us the result (server to server)
  if (action === "ipn") {
    const p = Object.fromEntries(url.searchParams);
    if (request.method === "POST") Object.assign(p, Object.fromEntries(new URLSearchParams(await request.text())));
    const good = sha256(PF.hash({ ...p, secured_key: E.PAYFAST_SECURED_KEY, merchant_id: E.PAYFAST_MERCHANT_ID })) === String(p.validation_hash || "").toLowerCase();
    const o = good && PF.okCodes.includes(String(p.err_code)) ? await readOrder(p.basket_id) : null;
    if (!o) return new Response("ignored", { status: 200 });
    if (o.status !== "paid") await writeOrder(p.basket_id, { ...o, status: "paid", paidAt: Date.now(), txn: p.transaction_id || "" });
    return new Response("ok");
  }

  // 3) customer returns: show download buttons only for a PAID order
  if (action === "return") {
    const b = url.searchParams.get("basket"), s = url.searchParams.get("sig");
    if (s !== sign(b || "")) return html("<h2>Invalid link</h2>");
    const o = await readOrder(b);
    if (!o) return html("<h2>Order not found</h2>");
    if (o.status !== "paid") return html(`<meta http-equiv=refresh content=4><h2>Confirming your payment…</h2><p>This page refreshes by itself. Please wait a moment.</p>`);
    const cat = await catalog(site), me = `${self}?action=download&basket=${b}&sig=${s}`;
    const btn = o.ids.map((i) => `<p><a href="${me}&book=${encodeURIComponent(i)}" style="display:block;background:#14532d;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none">⬇ Download PDF: ${esc((cat.find((x) => x.id === i) || { title: i }).title)}</a></p>`).join("");
    const keep = `https://wa.me/${String(o.phone).replace(/\D/g, "").replace(/^0/, "92")}?text=${encodeURIComponent("My Darul Ishaat PDF download link (valid " + DAYS_VALID + " days): " + `${self}?action=return&basket=${b}&sig=${s}`)}`;
    return html(`<h2>Payment received. Thank you, ${esc(o.name)}!</h2>${btn}<p><a href="${keep}">💬 Save this link on my WhatsApp</a></p><p style="color:#666;font-size:14px">The link works for ${DAYS_VALID} days. Questions? Contact our representative on WhatsApp.</p>`);
  }

  // 4) the actual PDF, only for a PAID order, only for books in that order
  if (action === "download") {
    const b = url.searchParams.get("basket"), s = url.searchParams.get("sig"), id = url.searchParams.get("book") || "";
    if (s !== sign(b || "")) return new Response("Invalid link", { status: 403 });
    const o = await readOrder(b);
    if (!o || o.status !== "paid" || !o.ids.includes(id) || Date.now() - o.paidAt > DAYS_VALID * 864e5) return new Response("Not available", { status: 403 });
    const f = await (await blob()).get(`pdf/${id}.pdf`, { access: "private" }).catch(() => null);
    if (!f || f.statusCode !== 200) return new Response("File not found", { status: 404 });
    return new Response(f.stream, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${id}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }
  return new Response("Not found", { status: 404 });
}

// Works with Vercel's classic Node style (req, res) and with Web Request style.
export default async function handler(req, res) {
  try {
    if (!res) return await core(req); // Web Request style
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const url = `https://${host}${req.url}`;
    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.body !== undefined && req.body !== null) body = typeof req.body === "string" || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
      else { const c = []; for await (const x of req) c.push(x); body = Buffer.concat(c); }
    }
    const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    const r = await core(new Request(url, { method: req.method, headers, body }));
    res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v));
    if (r.body) Readable.fromWeb(r.body).pipe(res); else res.end();
  } catch (e) {
    console.error("payfast-webhook error:", e);
    const out = JSON.stringify({ error: "server error", detail: String((e && e.message) || e) });
    if (res) { res.statusCode = 500; res.setHeader("Content-Type", "application/json"); res.end(out); }
    else return new Response(out, { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
