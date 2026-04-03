-- 1. Create a function that makes an HTTP POST request to your Edge Function
CREATE OR REPLACE FUNCTION public.handle_new_waitlist_signup()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
BEGIN
  -- REPLACE "inzzzsahvpeqqdfcrjda" with your actual Supabase project ID!
  edge_function_url := 'https://inzzzsahvpeqqdfcrjda.supabase.co/functions/v1/resend-webhook';

  -- Automatically trigger an HTTP request to the Edge function
  perform net.http_post(
      url := edge_function_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := json_build_object('record', row_to_json(NEW))::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the Trigger on the waitlist table
DROP TRIGGER IF EXISTS on_waitlist_signup ON public.waitlist;

CREATE TRIGGER on_waitlist_signup
  AFTER INSERT ON public.waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_waitlist_signup();
