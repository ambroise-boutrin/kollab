-- Lien direct membre → profil, pour que l'API puisse joindre les deux (select … profiles(…)).
alter table public.group_members
  add constraint group_members_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;

notify pgrst, 'reload schema';
