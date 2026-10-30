// Paste into your site's script. Call it from the "Pay with Easypaisa/JazzCash" buttons:
//   payWithPayFast({ orderId: 'DI-XXXX', amount: 1500, phone: '+92...' })
async function payWithPayFast({ orderId, amount, phone, email }) {
  const r = await fetch('/api/payfast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, amount, phone, email }),
  });
  const data = await r.json();
  if (!data.action) { alert('PayFast se connect nahi ho saka. Dobara koshish karein.'); return; }
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = data.action;
  for (const [k, v] of Object.entries(data.fields)) {
    const i = document.createElement('input');
    i.type = 'hidden'; i.name = k; i.value = v;
    form.appendChild(i);
  }
  document.body.appendChild(form);
  form.submit();
}
