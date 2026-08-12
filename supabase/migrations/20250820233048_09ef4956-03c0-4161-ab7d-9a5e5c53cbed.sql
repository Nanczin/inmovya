-- Fix security issues by adding search_path to functions

-- Drop and recreate functions with proper search_path
DROP FUNCTION IF EXISTS public.reset_gmail_daily_counts();
CREATE OR REPLACE FUNCTION public.reset_gmail_daily_counts()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.gmail_accounts 
  SET 
    current_count = 0,
    last_reset_date = CURRENT_DATE,
    status = CASE 
      WHEN status = 'limit_reached' THEN 'active'
      ELSE status
    END
  WHERE last_reset_date < CURRENT_DATE;
END;
$$;

-- Drop and recreate get_next_gmail_account function
DROP FUNCTION IF EXISTS public.get_next_gmail_account(UUID);
CREATE OR REPLACE FUNCTION public.get_next_gmail_account(p_user_id UUID)
RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  account_id UUID;
BEGIN
  -- First reset counts if needed
  PERFORM public.reset_gmail_daily_counts();
  
  -- Get next available account
  SELECT id INTO account_id
  FROM public.gmail_accounts
  WHERE user_id = p_user_id
    AND is_active = true
    AND status = 'active'
    AND current_count < daily_limit
  ORDER BY current_count ASC, last_reset_date ASC
  LIMIT 1;
  
  RETURN account_id;
END;
$$;

-- Drop and recreate increment_gmail_usage function
DROP FUNCTION IF EXISTS public.increment_gmail_usage(UUID);
CREATE OR REPLACE FUNCTION public.increment_gmail_usage(p_account_id UUID)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.gmail_accounts
  SET 
    current_count = current_count + 1,
    status = CASE 
      WHEN current_count + 1 >= daily_limit THEN 'limit_reached'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_account_id;
END;
$$;