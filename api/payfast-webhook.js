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
