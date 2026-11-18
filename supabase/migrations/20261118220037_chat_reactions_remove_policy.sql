-- On retire ses propres réactions.
create policy "réactions retirées" on public.message_reactions for delete using (user_id = auth.uid());
