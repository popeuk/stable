-- Le nuage des tiroirs : la copie des données de gestion de chaque compte,
-- telles qu'elles sont rangées sur l'appareil, donc déjà chiffrées avec la
-- clé du compte (lib/account/vault.ts). Le serveur ne lit jamais leur contenu.
--
-- On n'y accède que par la fonction « tiroirs », qui vérifie le compte auprès
-- de mon-ecurie.fr : le cloisonnement est fait là, avec la clé de service.
-- Aucun accès direct (RLS active, aucune règle, droits retirés).

create table public.tiroirs (
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
create table public.tiroirs_versions (
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
create index tiroirs_versions_compte on public.tiroirs_versions (user_id, nom, gardee_le desc);

alter table public.tiroirs enable row level security;
alter table public.tiroirs_versions enable row level security;
revoke all on public.tiroirs, public.tiroirs_versions from anon, authenticated;
revoke all on sequence public.tiroirs_versions_id_seq from anon, authenticated;

create function public.tiroirs_garder_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.tiroirs_versions (user_id, nom, rev, contenu, modifie, appareil, raison)
  values (old.user_id, old.nom, old.rev, old.contenu, old.modifie, old.appareil, 'remplacee');
  delete from public.tiroirs_versions v
  where v.user_id = old.user_id and v.nom = old.nom
    and v.id not in (
      select id from public.tiroirs_versions
      where user_id = old.user_id and nom = old.nom
      order by gardee_le desc, id desc limit 30
    );
  return new;
end $$;
revoke all on function public.tiroirs_garder_version() from public, anon, authenticated;

create trigger tiroirs_avant_maj before update on public.tiroirs
for each row execute function public.tiroirs_garder_version();
