-- Enable realtime for email campaigns table
ALTER TABLE public.email_campaigns REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
ALTER publication supabase_realtime ADD TABLE public.email_campaigns;