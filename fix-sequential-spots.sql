-- Fix for sequential waitlist spots
-- This script ensures that every new signup gets a position equal to (current_count + 1).

-- 1. Create the function to calculate the next position
CREATE OR REPLACE FUNCTION public.assign_next_waitlist_position()
RETURNS TRIGGER AS $$
BEGIN
    -- Set waitlist_position to current count + 1
    SELECT COUNT(*) + 1 INTO NEW.waitlist_position FROM public.waitlist;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
-- We use BEFORE INSERT so we can modify the NEW record before it's saved.
DROP TRIGGER IF EXISTS tr_assign_next_waitlist_position ON public.waitlist;
CREATE TRIGGER tr_assign_next_waitlist_position
    BEFORE INSERT ON public.waitlist
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_next_waitlist_position();

-- Note: We don't remove the SERIAL default from the column because it doesn't hurt,
-- but the trigger will now override any value the sequence would have generated.
