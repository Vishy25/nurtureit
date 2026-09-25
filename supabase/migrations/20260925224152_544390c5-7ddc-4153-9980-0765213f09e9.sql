
DELETE FROM public.memberships m WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = m.user_id);
UPDATE public.audit_events a SET actor_id = NULL WHERE actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = a.actor_id);
ALTER TABLE public.memberships ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
