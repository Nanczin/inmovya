alter table leads 
add column if not exists journey_map_data jsonb default '{}'::jsonb;
