-- Add image attachments column to email campaigns
ALTER TABLE email_campaigns 
ADD COLUMN IF NOT EXISTS image_attachments jsonb DEFAULT '[]'::jsonb;

-- Add image attachments column to email queue
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS image_attachments jsonb DEFAULT '[]'::jsonb;