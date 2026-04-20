-- 0. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    waitlist_position SERIAL,
    platform TEXT,
    key_feature TEXT,
    payment_status TEXT DEFAULT 'pending',
    plan_selected TEXT,
    is_priority BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to ensure sequential waitlist positions (total count + 1)
CREATE OR REPLACE FUNCTION public.assign_next_waitlist_position()
RETURNS TRIGGER AS $$
BEGIN
    SELECT COUNT(*) + 1 INTO NEW.waitlist_position FROM public.waitlist;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_assign_next_waitlist_position ON public.waitlist;
CREATE TRIGGER tr_assign_next_waitlist_position
    BEFORE INSERT ON public.waitlist
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_next_waitlist_position();


-- Enable Row Level Security (RLS)
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- 1. Allow anonymous inserts to the waitlist from your frontend
CREATE POLICY "Allow public inserts to waitlist"
ON public.waitlist FOR INSERT TO public
WITH CHECK (true);

-- 2. Allow public reads to get the counter (everyone can count)
CREATE POLICY "Allow public select on waitlist"
ON public.waitlist FOR SELECT TO public
USING (true);

-- 3. Allow public updates to the waitlist (useful for client-side payment mocks)
CREATE POLICY "Allow public updates to waitlist"
ON public.waitlist FOR UPDATE TO public
USING (true);
