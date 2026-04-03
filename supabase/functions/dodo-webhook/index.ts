import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// This is an example Supabase Edge Function to handle DodoPayment Webhooks.
// You would configure DodoPayments to send POST requests here when a payment succeeds.

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // To secure this in production, verify the DodoPayments webhook signature
  // const signature = req.headers.get('Dodo-Signature'); // (mock implementation)

  try {
    const payload = await req.json();

    // Check if the event is a successful payment
    if (payload.type === 'payment.succeeded') {
      const email = payload.data.customer_email;
      const planId = payload.data.product_id;

      let planSelected = 'standard';
      if (planId === Deno.env.get('DODO_PRODUCT_VIP_ID')) {
        planSelected = 'vip';
      }

      // Initialize Supabase Client with SERVICE_ROLE key (bypasses RLS)
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Mark user as priority and update payment status
      const { data, error } = await supabase
        .from('waitlist')
        .update({
          payment_status: 'paid',
          plan_selected: planSelected,
          is_priority: true
        })
        .eq('email', email);

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({ received: true }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // Ignore other events
    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
