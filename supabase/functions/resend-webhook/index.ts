import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    const record = payload.record;
    
    if (!record || !record.email) {
      return new Response('No email found in payload', { status: 400 });
    }

    const email = record.email;
    const position = record.waitlist_position || "...";

    // Premium Email Template (Beige & Dark aesthetic)
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
          .badge { display: inline-block; background: rgba(45, 91, 227, 0.08); color: #2D5BE3; border-radius: 100px; padding: 8px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 24px; }
          .position-hero { margin: 32px 0; }
          .position-num { font-family: serif; font-style: italic; font-size: 80px; line-height: 1; color: #1C1C1C; margin: 0; }
          .position-label { font-size: 14px; font-weight: 600; color: #6B6560; text-transform: uppercase; letter-spacing: 1px; }
          .footer { padding: 32px; background: #F9F7F5; text-align: center; color: #6B6560; font-size: 14px; }
          .btn { display: inline-block; background: #2D5BE3; color: #FFFFFF; text-decoration: none; padding: 16px 32px; border-radius: 100px; font-weight: 600; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="logo">Caltryx.</span>
          </div>
          <div class="content">
            <div class="badge">Waitlist Confirmed</div>
            <h1 style="font-family: serif; font-size: 32px; font-weight: 500; margin-bottom: 16px;">You’re in the queue.</h1>
            <p style="color: #6B6560; font-size: 16px; line-height: 1.6;">Your spot is secured. We are onboarding early users in batches. Here is where you stand today:</p>
            
            <div class="position-hero">
              <p class="position-num">#${position}</p>
              <p class="position-label">Current Position</p>
            </div>
            
            <p style="color: #6B6560; font-size: 15px; line-height: 1.6;">Want to skip the queue? Check out our priority early access plans to get instant beta access.</p>
            <a href="https://caltryx.xyz/waitlist?email=${encodeURIComponent(email)}" class="btn">View Priority Access →</a>
          </div>
          <div class="footer">
            &copy; 2026 Caltryx. The ultimate AI observability infrastructure.
          </div>
        </div>
      </body>
      </html>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Caltryx <welcome@caltryx.xyz>', 
        to: email, 
        reply_to: 'welcome@caltryx.xyz',
        subject: `Your Caltryx Spot: #${position} 🎉`,
        html: html,
        text: `Welcome to Caltryx! Your spot is secured at #${position}. We're building the ultimate AI observability infrastructure. View priority access here: https://caltryx.xyz/waitlist?email=${encodeURIComponent(email)}`
      })
    });

    const data = await res.json();
    console.log("Resend API Response Status:", res.status);
    console.log("Resend API Response Data:", JSON.stringify(data, null, 2));

    if (res.ok) {
      return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      console.error("Resend API Error Detail:", JSON.stringify(data, null, 2));
      return new Response(JSON.stringify({ error: data }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

  } catch (error) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
