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

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { plan, email, return_url } = await req.json();
    console.log(`Processing checkout for ${email} - Plan: ${plan}`);
    
    if (!email || !plan) {
      return new Response(JSON.stringify({ error: 'Missing email or plan' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const productId = plan === 'vip' ? DODO_PRODUCT_VIP_ID : DODO_PRODUCT_STANDARD_ID;
    console.log(`Using Product ID: ${productId}`);

    if (!DODO_PAYMENTS_KEY) {
      console.error("DODO_PAYMENTS_KEY missing");
      throw new Error("Server config error (key missing)");
    }

    // Correct V1 Dodo Payment checkout session endpoint
    const res = await fetch('https://api.dodopayments.com/v1/checkouts', {
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

    const data = await res.json();
    console.log("Dodo API Response Status:", res.status);
    console.log("Dodo API Response Full:", JSON.stringify(data));

    if (res.ok) {
      return new Response(JSON.stringify({ checkout_url: data.checkout_url }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    } else {
      console.error("Dodo API Error Rejection:", JSON.stringify(data));
      // Return the inner error message from Dodo if it exists
      const errorMessage = data.message || data.error?.message || JSON.stringify(data);
      return new Response(JSON.stringify({ error: errorMessage }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

  } catch (error) {
    console.error("Internal Server Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
