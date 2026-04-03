import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// It's best practice to use Deno.env.get() for secrets in production,
// but we'll fall back to your provided key to make it work immediately.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "re_j4r3b4HA_8sMVC9dPP23WwaeYrpVGsTLn";

serve(async (req) => {
  // Only accept POST requests from the Supabase Database Webhook
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    
    // In a Supabase Database Insert Webhook, the newly created row is inside `payload.record`
    const record = payload.record;
    
    if (!record || !record.email) {
      return new Response('No email found in payload', { status: 400 });
    }

    const email = record.email;
    const position = record.waitlist_position;

    // Send email using Resend REST API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // NOTE: Until you verify a custom domain (like founders@caltryx.com), 
        // you must use 'onboarding@resend.dev' as the FROM address.
        from: 'onboarding@resend.dev', 
        to: email, 
        subject: 'You’re on the Caltryx waitlist! 🎉',
        html: `
          <div style="font-family: sans-serif; color: #1C1C1C; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2D5BE3;">Welcome to Caltryx!</h2>
            <p>Your spot is secured. You are officially <strong>#${position}</strong> on the waitlist.</p>
            <p>We're hard at work building the ultimate AI cost observability infrastructure.</p>
            <br/>
            <p>If you'd like to skip the queue and get instant early/beta access, <a href="https://caltryx.com/waitlist?email=${encodeURIComponent(email)}" style="color: #2D5BE3; font-weight: bold;">check out our priority early access plans here.</a></p>
            <br/>
            <p>Best,<br/>The Caltryx Team</p>
          </div>
        `
      })
    });

    const data = await res.json();

    if (res.ok) {
      return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      console.error("Resend API Error:", data);
      return new Response(JSON.stringify({ error: data }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

  } catch (error) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
