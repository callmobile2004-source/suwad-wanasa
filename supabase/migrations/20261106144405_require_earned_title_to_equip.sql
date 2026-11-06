drop policy if exists "profile owner updates own" on public.profiles;
create policy "profile owner updates own earned title"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check (
  (select auth.uid()) = id
  and (
    equipped_title_id is null
    or exists (
      select 1 from public.player_titles pt
      where pt.user_id = (select auth.uid())
        and pt.title_id = equipped_title_id
    )
  )
);
