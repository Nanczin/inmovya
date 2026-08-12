-- Fix the incomplete username in skymail SMTP configuration
UPDATE smtp_configurations 
SET username = 'evgconsultoriaimob@skymail.net.br' 
WHERE provider = 'skymail' AND username = 'e';