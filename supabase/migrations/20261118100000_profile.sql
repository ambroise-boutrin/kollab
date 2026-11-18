-- Profil modifiable : rôle dans l'équipe, statut, photo.
alter table public.profiles
  add column title text not null default '' check (char_length(title) <= 60),
  add column status text not null default 'available' check (status in ('available', 'busy', 'away')),
  add column avatar_url text;

alter table public.profiles
  add constraint profiles_name_len check (char_length(name) between 1 and 40),
  add constraint profiles_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$');

-- Photos de profil : lisibles par tous, chacun écrit seulement dans son dossier.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "avatar envoyé par soi" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar remplacé par soi" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar supprimé par soi" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
