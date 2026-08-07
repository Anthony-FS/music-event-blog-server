import "dotenv/config";

import connectionPool from "../utils/db.mjs";

await connectionPool.query(`
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'avatar-images',
    'avatar-images',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
  on conflict (id) do update
  set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types
`);

await connectionPool.query(`
  drop policy if exists "Users can upload their own avatars" on storage.objects
`);
await connectionPool.query(`
  create policy "Users can upload their own avatars"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatar-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
`);

await connectionPool.query(`
  drop policy if exists "Users can update their own avatars" on storage.objects
`);
await connectionPool.query(`
  create policy "Users can update their own avatars"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatar-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatar-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
`);

await connectionPool.query(`
  drop policy if exists "Users can delete their own avatars" on storage.objects
`);
await connectionPool.query(`
  create policy "Users can delete their own avatars"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatar-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
`);

console.log("avatar-images bucket is ready.");
await connectionPool.end();
