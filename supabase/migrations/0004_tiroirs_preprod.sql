-- La jumelle de préprod de 0003_tiroirs.sql (28 novembre 2026) : les mêmes
-- tables, contraintes, index, déclencheur des 30 versions et RLS fermée, avec
-- le suffixe « _preprod ». Elles ne servent qu'à la fonction « tiroirs-preprod »
-- (supabase/functions/tiroirs-preprod), qui vérifie les comptes auprès du site
-- de préprod. Aucun objet ne porte le nom d'un objet de 0003.
--
-- Comme en production : aucun accès direct (RLS active, aucune règle, droits
-- retirés), le cloisonnement est fait dans la fonction avec la clé de service.

create table public.tiroirs_preprod (
  user_id  bigint      not null,
  nom      text        not null check (nom in ('be-stable-data', 'be-stable-settings')),
  rev      bigint      not null check (rev > 0),
  contenu  text        not null check (length(contenu) <= 5000000),
  modifie  timestamptz not null,
  appareil text,
  maj      timestamptz not null default now(),
  primary key (user_id, nom)
);

-- Les versions remplacées et les copies perdantes d'un conflit, pour revenir
-- en arrière si une synchronisation se trompe. On en garde 30 par tiroir.
create table public.tiroirs_versions_preprod (
  id        bigserial   primary key,
  user_id   bigint      not null,
  nom       text        not null,
  rev       bigint,
  contenu   text        not null,
  modifie   timestamptz,
  appareil  text,
  raison    text        not null check (raison in ('remplacee', 'conflit')),
  gardee_le timestamptz not null default now()
);
create index tiroirs_versions_preprod_compte on public.tiroirs_versions_preprod (user_id, nom, gardee_le desc);

alter table public.tiroirs_preprod enable row level security;
alter table public.tiroirs_versions_preprod enable row level security;
revoke all on public.tiroirs_preprod, public.tiroirs_versions_preprod from anon, authenticated;
revoke all on sequence public.tiroirs_versions_preprod_id_seq from anon, authenticated;

create function public.tiroirs_preprod_garder_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.tiroirs_versions_preprod (user_id, nom, rev, contenu, modifie, appareil, raison)
  values (old.user_id, old.nom, old.rev, old.contenu, old.modifie, old.appareil, 'remplacee');
  delete from public.tiroirs_versions_preprod v
  where v.user_id = old.user_id and v.nom = old.nom
    and v.id not in (
      select id from public.tiroirs_versions_preprod
      where user_id = old.user_id and nom = old.nom
      order by gardee_le desc, id desc limit 30
    );
  return new;
end $$;
revoke all on function public.tiroirs_preprod_garder_version() from public, anon, authenticated;

create trigger tiroirs_preprod_avant_maj before update on public.tiroirs_preprod
for each row execute function public.tiroirs_preprod_garder_version();
