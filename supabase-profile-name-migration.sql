-- سَـوَاد وناسة: السماح لصاحب الحساب بتعديل الاسم الظاهر فقط.
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor للمشاريع الموجودة.
begin;
alter table public.profiles enable row level security;
drop policy if exists "profile owner updates own" on public.profiles;
create policy "profile owner updates own"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;
commit;
