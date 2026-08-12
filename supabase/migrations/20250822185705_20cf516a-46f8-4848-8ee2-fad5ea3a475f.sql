-- Atualizar a função get_next_gmail_account para lidar melhor com contas em erro
CREATE OR REPLACE FUNCTION public.get_next_gmail_account(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  account_id UUID;
  account_with_error UUID;
BEGIN
  -- First reset counts if needed
  PERFORM public.reset_gmail_daily_counts();
  
  -- Try to get an active account first (not in error state)
  SELECT id INTO account_id
  FROM public.gmail_accounts
  WHERE user_id = p_user_id
    AND is_active = true
    AND status = 'active'
    AND current_count < daily_limit
  ORDER BY current_count ASC, last_reset_date ASC
  LIMIT 1;
  
  -- If no active account found, try to find an account with error that we can reactivate
  IF account_id IS NULL THEN
    SELECT id INTO account_with_error
    FROM public.gmail_accounts
    WHERE user_id = p_user_id
      AND is_active = true
      AND status = 'error'
      AND current_count < daily_limit
    ORDER BY updated_at ASC -- Get the oldest error account
    LIMIT 1;
    
    -- If we found an error account, try to reactivate it
    IF account_with_error IS NOT NULL THEN
      UPDATE public.gmail_accounts
      SET status = 'active',
          updated_at = now()
      WHERE id = account_with_error;
      
      account_id := account_with_error;
    END IF;
  END IF;
  
  RETURN account_id;
END;
$function$;