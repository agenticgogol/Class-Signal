alter table public.public_settings
  alter column active_access_code set default 'AgenticAI-2026';

update public.public_settings
set active_access_code = 'AgenticAI-2026'
where is_active = true
  and (active_access_code is null or btrim(active_access_code) = '');
