-- Fix security warnings by updating auth configuration
-- 1. Reduce OTP expiry to recommended 10 minutes (600 seconds)
UPDATE auth.config 
SET 
  otp_expiry = 600,
  password_min_length = 8,
  enable_signup = true,
  enable_confirmations = true
WHERE instance_id = '00000000-0000-0000-0000-000000000000';

-- Note: Leaked password protection needs to be enabled through the dashboard at:
-- https://supabase.com/dashboard/project/{project_id}/auth/providers