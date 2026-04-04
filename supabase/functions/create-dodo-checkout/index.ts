import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DODO_PAYMENTS_KEY = Deno.env.get("DODO_PAYMENTS_KEY");
const DODO_PRODUCT_STANDARD_ID = Deno.env.get("DODO_PRODUCT_STANDARD_ID");
const DODO_PRODUCT_VIP_ID = Deno.env.get("DODO_PRODUCT_VIP_ID");

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Validate Environment Variables
    if (!DODO_PAYMENTS_KEY) throw new Error("DODO_PAYMENTS_KEY missing from Supabase secrets.");
    if (!DODO_PRODUCT_STANDARD_ID) throw new Error("DODO_PRODUCT_STANDARD_ID missing.");
    if (!DODO_PRODUCT_VIP_ID) throw new Error("DODO_PRODUCT_VIP_ID missing.");

    // 2. Parse Request
    const body = await req.json().catch(() => ({}));
    const { plan, email, return_url } = body;
    
    console.log(`Checkout Request: ${email} for ${plan}`);

    if (!email || !plan) {
      return new Response(JSON.stringify({ error: "Email and Plan are required." }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const productId = plan === 'vip' ? DODO_PRODUCT_VIP_ID : DODO_PRODUCT_STANDARD_ID;

    // 3. Call Dodo Payments
    const dodoRes = await fetch('https://api.dodopayments.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_PAYMENTS_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email: email },
        return_url: return_url || 'https://caltryx.xyz/waitlist?status=success',
        payment_link: true
      })
    });

    const dodoData = await dodoRes.json().catch(() => ({ error: "Invalid JSON from Dodo API" }));
    console.log(`Dodo API Status: ${dodoRes.status}`, dodoData);

    if (dodoRes.ok) {
      return new Response(JSON.stringify({ checkout_url: dodoData.checkout_url }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    } else {
      const errorMsg = dodoData.message || dodoData.error?.message || "Dodo API Error";
      return new Response(JSON.stringify({ error: errorMsg }), { 
        status: dodoRes.status, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

  } catch (err) {
    console.error("Edge Function Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
