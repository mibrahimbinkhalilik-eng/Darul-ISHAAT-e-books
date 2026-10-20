// ===== EDIT THESE, then commit =====
window.CFG={
 store:"Darul Ishaat E-Book", currency:"Rs.",
 whatsapp:"923XXXXXXXXX",                 // your WhatsApp number, international format, no +
 easypaisa:{name:"Your Name",number:"03XX-XXXXXXX"},
 jazzcash:{name:"Your Name",number:"03XX-XXXXXXX"},
 // Card payments need a merchant gateway (PayFast PK, Safepay, ...).
 // Paste its hosted checkout / payment-link URL here. Leave "" and the button sends the order to WhatsApp instead.
 cardCheckoutUrl:"",
 // Where covers and page images are loaded from. "books/" = this repository.
 // For a very large library, upload the books/ folder to Vercel Blob / Cloudflare R2 / S3 and put its public URL here,
 // e.g. "https://xxxx.public.blob.vercel-storage.com/books/"  (must end with "/").
 imageBase:"books/"
};
