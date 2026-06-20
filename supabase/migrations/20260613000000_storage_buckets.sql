-- Create public bucket for CRM media files (photos of repairs, devices, etc.)
insert into storage.buckets (id, name, public)
values ('crm_media', 'crm_media', true)
on conflict (id) do nothing;

-- Set up RLS policies for the bucket
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'crm_media' );

create policy "Authenticated users can upload files"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'crm_media' );

create policy "Authenticated users can update their own files"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'crm_media' and auth.uid() = owner )
  with check ( bucket_id = 'crm_media' and auth.uid() = owner );

create policy "Authenticated users can delete their own files"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'crm_media' and auth.uid() = owner );
