-- Kindscore · migration 8 of 8 · storage buckets and object policies
-- proofs:        private. A winner's screenshot (§09) lives at {user_id}/{verification_id}.{ext}.
-- charity-media: public read. Covers and galleries the admin uploads (§11.03).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('proofs',        'proofs',        false, 5 * 1024 * 1024, array['image/png', 'image/jpeg', 'image/webp']),
  ('charity-media', 'charity-media', true,  2 * 1024 * 1024, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- A member may write and read only inside their own folder; the folder name is their user id.
create policy proofs_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy proofs_select_own on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy proofs_update_own on storage.objects for update to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy proofs_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and (select is_admin()));

-- Charity media: anyone can view; only admins can change.
create policy charity_media_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'charity-media');

create policy charity_media_admin_write on storage.objects for insert to authenticated
  with check (bucket_id = 'charity-media' and (select is_admin()));

create policy charity_media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'charity-media' and (select is_admin()));

create policy charity_media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'charity-media' and (select is_admin()));
