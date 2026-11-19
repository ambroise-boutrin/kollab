-- Logo de projet : colonne + espace de stockage public, envoi réservé aux admins du projet.
alter table public.groups add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "logo envoyé par admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.is_admin(((storage.foldername(name))[1])::uuid));
create policy "logo lu par membre" on storage.objects for select to authenticated
  using (bucket_id = 'logos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "logo remplacé par admin" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.is_admin(((storage.foldername(name))[1])::uuid));
