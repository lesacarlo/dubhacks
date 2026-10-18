-- Stores the OpenAI Agents API session associated with an anonymous First Trip journey.
alter table public.outfitter_sessions
  add column if not exists openai_agent_id text,
  add column if not exists openai_agent_session_id text,
  add column if not exists openai_agent_session_updated_at timestamptz;

create index if not exists outfitter_sessions_openai_agent_session_id_idx
  on public.outfitter_sessions (openai_agent_session_id)
  where openai_agent_session_id is not null;
