-- Les fonctions ne sont appelables que par les utilisateurs connectés.
-- (PUBLIC a EXECUTE par défaut : le révoquer à anon seul ne suffit pas.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.can_write(uuid) from public, anon;
revoke execute on function public.is_admin(uuid) from public, anon;
revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.join_group(text) from public, anon;
revoke execute on function public.set_discord_webhook(uuid, text) from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;

grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.can_write(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.set_discord_webhook(uuid, text) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
