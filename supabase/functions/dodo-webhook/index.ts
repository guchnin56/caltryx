import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

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
      const { data: updateData, error: updateError } = await supabase
        .from('waitlist')
        .update({
          payment_status: 'paid',
          plan_selected: planSelected,
          is_priority: true
        })
        .eq('email', email)
        .select()
        .single();

      if (updateError) throw updateError;

      // Send Welcome Email via Resend
      if (RESEND_API_KEY) {
        const planName = planSelected === 'vip' ? 'Lifetime VIP Access' : 'Early Bird Priority Access';
        
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: 'DM Sans', sans-serif; background-color: #F5F2ED; color: #1C1C1C; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 40px auto; background: #FFFFFF; border: 1px solid rgba(28,28,28,0.1); border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
              .header { padding: 40px; text-align: center; border-bottom: 1px solid rgba(28,28,28,0.05); }
              .logo { font-size: 24px; font-weight: 700; color: #1C1C1C; text-decoration: none; }
              .content { padding: 40px; text-align: center; }
              .badge { display: inline-block; background: rgba(16, 185, 129, 0.08); color: #059669; border-radius: 100px; padding: 8px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 24px; }
              .footer { padding: 32px; background: #F9F7F5; text-align: center; color: #6B6560; font-size: 14px; }
              .btn { display: inline-block; background: #2D5BE3; color: #FFFFFF; text-decoration: none; padding: 16px 32px; border-radius: 100px; font-weight: 600; margin-top: 24px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header"><span class="logo">Caltryx.</span></div>
              <div class="content">
                <div class="badge">Priority Access Activated</div>
                <h1 style="font-family: serif; font-size: 32px; font-weight: 500; margin-bottom: 16px;">Welcome to the Inner Circle.</h1>
                <p style="color: #6B6560; font-size: 16px; line-height: 1.6;">Your payment was successful and your spot has been moved to the front of the queue.</p>
                
                <div style="margin: 32px 0; padding: 24px; background: #F5F2ED; border-radius: 16px; text-align: left;">
                  <p style="margin: 0 0 8px 0; font-weight: 600; color: #1C1C1C;">Plan: ${planName}</p>
                  <p style="margin: 0; font-size: 14px; color: #6B6560;">Status: Priority Beta Access 🚀</p>
                </div>
                
                <p style="color: #6B6560; font-size: 15px; line-height: 1.6;">We are currently finalizing the infrastructure. You will receive an invite link at this email address as soon as the beta opens.</p>
                <a href="${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.xyz') || 'https://caltryx.xyz'}/waitlist?email=${encodeURIComponent(email)}&status=success&plan=${planSelected}" class="btn">View Your Status →</a>
              </div>
              <div class="footer">
                &copy; 2026 Caltryx. AI Observability built by <a href="https://x.com/showslikesummu" style="color: #2D5BE3; text-decoration: none;">summu</a>.<br/>
                Hyderabad, India.
              </div>
            </div>
          </body>
          </html>
        `;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Caltryx <welcome@caltryx.xyz>',
            to: email,
            subject: `Payment Confirmed: Welcome to Caltryx Priority Access! 🎉`,
            html: html
          })
        });
      }

      return new Response(JSON.stringify({ received: true }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
