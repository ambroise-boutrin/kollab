-- L'envoi d'une photo de profil a besoin de pouvoir relire son propre dossier.
create policy "avatar lu par soi" on storage.objects for select to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
