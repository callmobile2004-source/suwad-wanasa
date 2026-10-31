-- شات اللمة العام: سجل مشترك بين كل الأعضاء المسجلين.
create table if not exists public.public_messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 500),
 created_at timestamptz not null default now()
);
create index if not exists public_messages_created_idx on public.public_messages(created_at desc);
alter table public.public_messages drop constraint if exists public_messages_body_check;
alter table public.public_messages add constraint public_messages_body_check check (char_length(btrim(body)) between 1 and 500);
create or replace function public.enforce_public_chat_rate_limit()
returns trigger language plpgsql security definer set search_path=''
as $
begin
 if char_length(btrim(new.body)) not between 1 and 500 then raise exception 'رسالة الشات يجب أن تكون بين حرف واحد و٥٠٠ حرف.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.sender_id::text));
 if exists (select 1 from public.public_messages m where m.sender_id=new.sender_id and m.created_at>pg_catalog.now()-interval '2 seconds') then raise exception 'انتظر ثانيتين قبل إرسال رسالة أخرى.'; end if;
 return new;
end;
$;
drop trigger if exists public_messages_rate_limit on public.public_messages;
create trigger public_messages_rate_limit before insert on public.public_messages for each row execute function public.enforce_public_chat_rate_limit();
alter table public.public_messages enable row level security;
drop policy if exists "members read public chat" on public.public_messages;
create policy "members read public chat" on public.public_messages for select to authenticated using(true);
drop policy if exists "members send public chat as self" on public.public_messages;
create policy "members send public chat as self" on public.public_messages for insert to authenticated with check(auth.uid()=sender_id);
grant select,insert on public.public_messages to authenticated;
do $$
begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='public_messages') then
  alter publication supabase_realtime add table public.public_messages;
 end if;
end $$;
