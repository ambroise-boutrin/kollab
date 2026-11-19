-- Les liens se modifient (titre, adresse) et partent à la corbeille par une mise à jour.
create policy "liens modifiés" on public.links for update using (can_write(group_id)) with check (can_write(group_id));
