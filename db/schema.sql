-- Magdalena Kalender – Datenbankschema (Neon Postgres)
-- Zeiten werden als Wanduhrzeit in Europe/Berlin gespeichert (timestamp ohne Zeitzone),
-- genau wie Kalender.digital es tut. Ganztägige Termine: end_at ist exklusiv (00:00 des Folgetags).

create table if not exists calendars (
  id          text primary key,
  name        text not null,
  color       text not null,
  sort_order  integer not null default 0,
  source_key  text unique,              -- z. B. 'kd:3783599' für den Kalender.digital-Unterkalender
  visible     boolean not null default true,
  default_minutes integer not null default 60,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists events (
  id          text primary key,
  calendar_id text not null references calendars(id),
  title       text not null,
  notes       text not null default '',
  who         text not null default '',
  location    text not null default '',
  start_at    timestamp not null,
  end_at      timestamp not null,
  all_day     boolean not null default false,
  status      text not null default 'confirmed',   -- confirmed | tentative | cancelled
  origin      text not null default 'local',       -- local | kalenderdigital | digitalmask | website
  extra       jsonb not null default '{}'::jsonb,  -- Quellen-Details, Kontakt, Links
  locally_modified boolean not null default false,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists events_start_idx on events (start_at);
create index if not exists events_end_idx on events (end_at);
create index if not exists events_live_idx on events (deleted_at) where deleted_at is null;

-- Verknüpfung externer Einträge mit Kalenderterminen (ein Termin kann mehrere Quellen haben = Dubletten-Schutz)
create table if not exists event_links (
  source      text not null,               -- kalenderdigital | digitalmask | mj
  source_id   text not null,               -- stabile ID in der Quelle
  event_id    text not null references events(id) on delete cascade,
  hash        text,
  url         text,
  match_type  text not null default 'created',  -- created | matched | manual
  match_score real,
  match_reason text,
  payload     jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  primary key (source, source_id)
);
create index if not exists event_links_event_idx on event_links (event_id);

-- Mögliche Dubletten, die Lena prüfen kann
create table if not exists duplicate_candidates (
  a_id        text not null references events(id) on delete cascade,
  b_id        text not null references events(id) on delete cascade,
  score       real not null,
  reason      text not null default '',
  status      text not null default 'open',  -- open | dismissed | merged
  created_at  timestamptz not null default now(),
  primary key (a_id, b_id)
);

create table if not exists sync_runs (
  id          bigserial primary key,
  source      text not null,
  trigger     text not null default 'schedule',
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  fetched     integer not null default 0,
  created     integer not null default 0,
  updated     integer not null default 0,
  matched     integer not null default 0,
  review      integer not null default 0,
  removed     integer not null default 0,
  message     text
);
create index if not exists sync_runs_source_idx on sync_runs (source, started_at desc);

create table if not exists settings (
  key   text primary key,
  value jsonb not null
);
alter table calendars add column if not exists visible boolean not null default true;

-- Fehlgeschlagene Anmeldungen (Schutz gegen Durchprobieren des Passworts)
create table if not exists login_attempts (
  ip  text not null,
  at  timestamptz not null default now()
);
create index if not exists login_attempts_ip_idx on login_attempts (ip, at desc);
alter table event_links add column if not exists authoritative boolean not null default false;
