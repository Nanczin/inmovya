-- Create Gmail accounts table
CREATE TABLE public.gmail_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  app_password TEXT NOT NULL,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  daily_limit INTEGER NOT NULL DEFAULT 450,
  current_count INTEGER NOT NULL DEFAULT 0,
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, error
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

-- Enable RLS
ALTER TABLE public.gmail_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for Gmail accounts
CREATE POLICY "Users can manage their own Gmail accounts" 
ON public.gmail_accounts 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create email queue table
CREATE TABLE public.email_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  campanha_id UUID,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_data JSONB DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, sent, failed, cancelled
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  gmail_account_id UUID,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for email queue
CREATE POLICY "Users can manage their own email queue" 
ON public.email_queue 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create email campaigns table for better organization
CREATE TABLE public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  template_subject TEXT NOT NULL,
  template_body TEXT NOT NULL,
  total_emails INTEGER NOT NULL DEFAULT 0,
  sent_emails INTEGER NOT NULL DEFAULT 0,
  failed_emails INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, paused, completed, cancelled
  delay_min INTEGER NOT NULL DEFAULT 2, -- minimum delay in seconds
  delay_max INTEGER NOT NULL DEFAULT 8, -- maximum delay in seconds
  batch_size INTEGER NOT NULL DEFAULT 100, -- emails per batch before long pause
  batch_pause INTEGER NOT NULL DEFAULT 90, -- pause in seconds between batches
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

-- Create policies for email campaigns
CREATE POLICY "Users can manage their own email campaigns" 
ON public.email_campaigns 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to reset daily counts
CREATE OR REPLACE FUNCTION public.reset_gmail_daily_counts()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- Create function to get next available Gmail account
CREATE OR REPLACE FUNCTION public.get_next_gmail_account(p_user_id UUID)
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment Gmail account usage
CREATE OR REPLACE FUNCTION public.increment_gmail_usage(p_account_id UUID)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers for updating timestamps
CREATE TRIGGER update_gmail_accounts_updated_at
  BEFORE UPDATE ON public.gmail_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_queue_updated_at
  BEFORE UPDATE ON public.email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key relationships
ALTER TABLE public.email_queue 
ADD CONSTRAINT fk_email_queue_gmail_account 
FOREIGN KEY (gmail_account_id) REFERENCES public.gmail_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.email_queue 
ADD CONSTRAINT fk_email_queue_campanha 
FOREIGN KEY (campanha_id) REFERENCES public.email_campaigns(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_gmail_accounts_user_active ON public.gmail_accounts(user_id, is_active, status);
CREATE INDEX idx_email_queue_user_status ON public.email_queue(user_id, status);
CREATE INDEX idx_email_queue_scheduled ON public.email_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_email_campaigns_user_status ON public.email_campaigns(user_id, status);