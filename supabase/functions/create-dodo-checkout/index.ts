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

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    
    // Diagnostic Log (Visible in Supabase Dashboard -> Edge Functions -> Logs)
    console.log("--- Checkout Diagnostic ---");
    console.log("DODO_PAYMENTS_KEY detected:", !!DODO_PAYMENTS_KEY, DODO_PAYMENTS_KEY ? `(Starts with: ${DODO_PAYMENTS_KEY.substring(0, 4)}...)` : "(MISSING)");
    console.log("STANDARD_ID detected:", !!DODO_PRODUCT_STANDARD_ID, DODO_PRODUCT_STANDARD_ID ? `(Value: ${DODO_PRODUCT_STANDARD_ID})` : "(MISSING)");
    console.log("VIP_ID detected:", !!DODO_PRODUCT_VIP_ID, DODO_PRODUCT_VIP_ID ? `(Value: ${DODO_PRODUCT_VIP_ID})` : "(MISSING)");

    if (body.ping) {
      return new Response(JSON.stringify({ 
        pong: true, 
        secrets: { 
          key: !!DODO_PAYMENTS_KEY, 
          std: !!DODO_PRODUCT_STANDARD_ID, 
          vip: !!DODO_PRODUCT_VIP_ID 
        }
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { plan, email, return_url } = body;
    if (!email || !plan) throw new Error("Email and Plan are required.");

    const productId = plan === 'vip' ? DODO_PRODUCT_VIP_ID : DODO_PRODUCT_STANDARD_ID;
    
    // Correct base URLs: test.dodopayments.com for test keys, live.dodopayments.com for live
    const baseUrl = DODO_PAYMENTS_KEY?.startsWith('test_') 
      ? 'https://test.dodopayments.com' 
      : 'https://live.dodopayments.com';

    console.log(`Using endpoint: ${baseUrl} | Product: ${productId}`);

    const dodoRes = await fetch(`${baseUrl}/v1/checkouts`, {
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

    const dodoData = await dodoRes.json().catch(() => ({ error: "Invalid JSON response from Dodo Payments" }));

    if (dodoRes.ok) {
      return new Response(JSON.stringify({ checkout_url: dodoData.checkout_url }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    } else {
      const msg = dodoData.message || (dodoData.error ? JSON.stringify(dodoData.error) : "Dodo API Error");
      throw new Error(`Dodo API (${dodoRes.status}): ${msg}`);
    }

  } catch (err) {
    console.error("CRITICAL ERROR:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
