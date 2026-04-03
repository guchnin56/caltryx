-- Drop the entire table (and all its rows/policies) if it exists to start completely fresh
DROP TABLE IF EXISTS public.waitlist CASCADE;

-- Create the new table from scratch with everything required
CREATE TABLE public.waitlist (
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

-- Enable Row Level Security (RLS)
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- 1. Allow anonymous inserts to the waitlist from your frontend
CREATE POLICY "Allow public inserts to waitlist"
ON public.waitlist FOR INSERT TO anon
WITH CHECK (true);

-- 2. Allow public reads to get the counter (everyone can count)
CREATE POLICY "Allow public select on waitlist"
ON public.waitlist FOR SELECT TO anon
USING (true);

-- 3. Allow public updates to the waitlist (useful for client-side payment mocks)
CREATE POLICY "Allow public updates to waitlist"
ON public.waitlist FOR UPDATE TO anon
USING (true);
