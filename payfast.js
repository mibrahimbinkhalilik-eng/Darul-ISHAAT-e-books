// Vercel serverless function: creates a PayFast (GoPayFast) payment request.
// Env vars (Vercel): PAYFAST_MERCHANT_ID, PAYFAST_SECURED_KEY, PAYFAST_STORE_ID,
// PAYFAST_MERCHANT_NAME, PAYFAST_ENV ("sandbox" or "live"), optional PAYFAST_BASE_URL.
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const {
    PAYFAST_MERCHANT_ID: merchantId,
    PAYFAST_SECURED_KEY: securedKey,
    PAYFAST_STORE_ID: storeId = '',
    PAYFAST_MERCHANT_NAME: merchantName = 'Darul Ishaat',
    PAYFAST_ENV: env = 'sandbox',
  } = process.env;

  const baseUrl =
    process.env.PAYFAST_BASE_URL ||
    (env === 'live' ? 'https://ipg1.apps.net.pk' : 'https://ipguat.apps.net.pk');

  if (!merchantId || !securedKey) {
    return res.status(500).json({ error: 'PayFast env vars missing' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const amount = Number(body.amount);
  const orderId = String(body.orderId || '').replace(/[^A-Za-z0-9-]/g, '');
  const phone = String(body.phone || '').replace(/[^0-9+]/g, '');
  const email = String(body.email || '');

  if (!(amount > 0) || !orderId) {
    return res.status(400).json({ error: 'amount and orderId required' });
  }

  try {
    // 1) Get access token
    const tokenRes = await fetch(`${baseUrl}/Ecommerce/api/Transaction/GetAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: new URLSearchParams({
        MERCHANT_ID: merchantId,
        SECURED_KEY: securedKey,
        TXNAMT: String(amount),
        BASKET_ID: orderId,
      }).toString(),
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenJson.ACCESS_TOKEN) {
      return res.status(502).json({ error: 'No access token from PayFast', detail: tokenJson });
    }

    // 2) Build the form fields the browser will post to PayFast
    const site = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const orderDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

    return res.status(200).json({
      action: `${baseUrl}/Ecommerce/api/Transaction/PostTransaction`,
      fields: {
        MERCHANT_ID: merchantId,
        MERCHANT_NAME: merchantName,
        TOKEN: tokenJson.ACCESS_TOKEN,
        PROCCODE: '00',
        TXNAMT: String(amount),
        CUSTOMER_MOBILE_NO: phone,
        CUSTOMER_EMAIL_ADDRESS: email,
        SIGNATURE: crypto.createHash('sha256').update(orderId).digest('hex'),
        VERSION: 'DARULISHAAT-1.0',
        TXNDESC: `Order ${orderId} - ${merchantName}`,
        SUCCESS_URL: `${site}/?payfast=success&order=${orderId}`,
        FAILURE_URL: `${site}/?payfast=failed&order=${orderId}`,
        BASKET_ID: orderId,
        ORDER_DATE: orderDate,
        CHECKOUT_URL: `${site}/?payfast=callback&order=${orderId}`,
        TRAN_TYPE: 'ECOMM_PURCHASE',
        STORE_ID: storeId,
        CURRENCY_CODE: 'PKR',
      },
    });
  } catch (e) {
    return res.status(500).json({ error: 'PayFast request failed', detail: String(e) });
  }
};
