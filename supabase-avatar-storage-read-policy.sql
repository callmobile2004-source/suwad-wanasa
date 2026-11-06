-- Storage upsert needs SELECT as well as INSERT and UPDATE; only the owner's object is selectable via the API.
drop policy if exists "avatar owner reads" on storage.objects;
create policy "avatar owner reads" on storage.objects
  for select to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
