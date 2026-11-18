-- Les fonctions internes des notifications ne sont pas appelables depuis l'API.
revoke execute on function public.notify_assigned() from public, anon, authenticated;
revoke execute on function public.notify_mentions() from public, anon, authenticated;
revoke execute on function public.notify_joined() from public, anon, authenticated;
revoke execute on function public.sync_assignees() from public, anon, authenticated;
revoke execute on function public.actor_name() from public, anon, authenticated;
revoke execute on function public.invite_by_email(uuid, text, text) from public, anon;
grant execute on function public.invite_by_email(uuid, text, text) to authenticated;
