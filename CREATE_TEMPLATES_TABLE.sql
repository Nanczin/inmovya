create table if not exists journey_node_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  name text not null,
  nodes_data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Policy to allow authenticated users to read/write templates
alter table journey_node_templates enable row level security;

create policy "Users can view their own templates"
  on journey_node_templates for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own templates"
  on journey_node_templates for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own templates"
  on journey_node_templates for update
  using ( auth.uid() = user_id );

create policy "Users can delete their own templates"
  on journey_node_templates for delete
  using ( auth.uid() = user_id );
