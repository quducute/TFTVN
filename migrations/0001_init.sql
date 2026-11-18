CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TYPE user_role        AS ENUM ('user', 'admin');
CREATE TYPE user_token_kind  AS ENUM ('refresh', 'password_reset', 'email_verify');
CREATE TYPE article_status   AS ENUM ('queued', 'approved', 'rejected');
CREATE TYPE reaction_kind    AS ENUM ('heart', 'like', 'dislike');
CREATE TYPE meta_tier        AS ENUM ('S', 'A', 'B', 'C', 'X');
CREATE TYPE game_entity_kind AS ENUM ('champion', 'trait', 'item', 'augment', 'role');
CREATE TYPE rank_tier        AS ENUM ('challenger', 'grandmaster', 'master');
CREATE TYPE etl_status       AS ENUM ('running', 'succeeded', 'failed');

CREATE TABLE game_sets (
  id          integer PRIMARY KEY,
  name        text    NOT NULL,
  mutator     text    NOT NULL UNIQUE,
  is_current  boolean NOT NULL DEFAULT false,
  started_at  timestamptz
);
CREATE UNIQUE INDEX game_sets_is_current_key ON game_sets (is_current) WHERE is_current;

CREATE TABLE gamedata_snapshots (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  set_id       integer NOT NULL REFERENCES game_sets (id),
  source_hash  text    NOT NULL,
  archive_url  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (set_id, source_hash)
);

CREATE TABLE patches (
  id           text    PRIMARY KEY,
  set_id       integer NOT NULL REFERENCES game_sets (id),
  snapshot_id  bigint  NOT NULL REFERENCES gamedata_snapshots (id),
  released_at  timestamptz,
  is_current   boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX patches_is_current_key ON patches (is_current) WHERE is_current;
CREATE INDEX patches_set_id_idx ON patches (set_id);

CREATE TABLE game_entities (
  snapshot_id    bigint           NOT NULL REFERENCES gamedata_snapshots (id) ON DELETE CASCADE,
  kind           game_entity_kind NOT NULL,
  api_name       text             NOT NULL,
  i18n           jsonb            NOT NULL,
  data           jsonb            NOT NULL,
  cost           smallint,
  traits         text[],
  role_api_name  text,
  planner_code   char(3),
  PRIMARY KEY (snapshot_id, kind, api_name),
  CONSTRAINT game_entities_champion_fields_check
    CHECK (kind = 'champion'
           OR (cost IS NULL AND traits IS NULL AND role_api_name IS NULL AND planner_code IS NULL))
);
CREATE INDEX game_entities_traits_idx ON game_entities USING gin (traits);
CREATE INDEX game_entities_role_api_name_idx
  ON game_entities (snapshot_id, role_api_name) WHERE role_api_name IS NOT NULL;
CREATE UNIQUE INDEX game_entities_snapshot_id_planner_code_key
  ON game_entities (snapshot_id, planner_code) WHERE planner_code IS NOT NULL;

CREATE TABLE users (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username           citext    NOT NULL UNIQUE,
  email              citext    NOT NULL UNIQUE,
  email_verified_at  timestamptz,
  password_hash      text      NOT NULL,
  role               user_role NOT NULL DEFAULT 'user',
  riot_platform      text      NOT NULL DEFAULT 'vn2',
  riot_game_name     text,
  riot_tag_line      text,
  riot_puuid         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE user_tokens (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind        user_token_kind NOT NULL,
  token_hash  bytea           NOT NULL UNIQUE,
  expires_at  timestamptz     NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz     NOT NULL DEFAULT now()
);
CREATE INDEX user_tokens_user_id_kind_idx ON user_tokens (user_id, kind);
CREATE INDEX user_tokens_expires_at_idx   ON user_tokens (expires_at);

CREATE TABLE comps (
  id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id                 uuid    NOT NULL UNIQUE,
  owner_id                  bigint  NOT NULL REFERENCES users (id),
  set_id                    integer NOT NULL REFERENCES game_sets (id),
  name                      text    NOT NULL,
  description               text,
  difficulty                text,
  playstyle                 text,
  avatar_champion_api_name  text,
  board                     jsonb   NOT NULL,
  champions                 text[]  NOT NULL DEFAULT '{}',
  augments                  text[]  NOT NULL DEFAULT '{}',
  meta_tier                 meta_tier,
  meta_patch_id             text    REFERENCES patches (id),
  meta_updated_at           timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  deleted_at                timestamptz,
  CONSTRAINT comps_board_check
    CHECK (jsonb_typeof(board) = 'array' AND jsonb_array_length(board) <= 10),
  CONSTRAINT comps_meta_fields_check
    CHECK (meta_tier IS NOT NULL OR (meta_patch_id IS NULL AND meta_updated_at IS NULL)),
  CONSTRAINT comps_meta_not_deleted_check
    CHECK (meta_tier IS NULL OR deleted_at IS NULL)
);
CREATE INDEX comps_owner_id_idx       ON comps (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX comps_set_id_idx         ON comps (set_id)   WHERE deleted_at IS NULL;
CREATE INDEX comps_set_id_meta_tier_idx ON comps (set_id, meta_tier) WHERE meta_tier IS NOT NULL;
CREATE INDEX comps_champions_idx      ON comps USING gin (champions);
CREATE TRIGGER comps_set_updated_at BEFORE UPDATE ON comps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE bookmarks (
  user_id     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  comp_id     bigint NOT NULL REFERENCES comps (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comp_id)
);
CREATE INDEX bookmarks_comp_id_idx ON bookmarks (comp_id);

CREATE TABLE role_items (
  set_id         integer NOT NULL REFERENCES game_sets (id),
  role_api_name  text    NOT NULL,
  items          text[]  NOT NULL DEFAULT '{}',
  updated_by     bigint  REFERENCES users (id),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (set_id, role_api_name)
);
CREATE TRIGGER role_items_set_updated_at BEFORE UPDATE ON role_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE articles (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id    uuid    NOT NULL UNIQUE,
  author_id    bigint  NOT NULL REFERENCES users (id),
  set_id       integer REFERENCES game_sets (id),
  title        text    NOT NULL,
  category     text    NOT NULL,
  tags         text[]  NOT NULL DEFAULT '{}',
  body         text    NOT NULL,
  status       article_status NOT NULL DEFAULT 'queued',
  reviewed_by  bigint  REFERENCES users (id),
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX articles_status_created_at_idx ON articles (status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX articles_author_id_idx         ON articles (author_id);
CREATE INDEX articles_tags_idx              ON articles USING gin (tags);
CREATE TRIGGER articles_set_updated_at BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE article_reactions (
  article_id  bigint NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  user_id     bigint NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
  kind        reaction_kind NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);
CREATE INDEX article_reactions_user_id_idx ON article_reactions (user_id);

CREATE TABLE article_comps (
  article_id  bigint NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  comp_id     bigint NOT NULL REFERENCES comps (id)    ON DELETE CASCADE,
  PRIMARY KEY (article_id, comp_id)
);
CREATE INDEX article_comps_comp_id_idx ON article_comps (comp_id);

CREATE TABLE matches (
  id                text PRIMARY KEY,
  set_id            integer   NOT NULL,
  patch_id          text      NOT NULL,
  queue_id          integer   NOT NULL,
  source_rank_tier  rank_tier NOT NULL,
  played_at         timestamptz NOT NULL,
  fetched_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX matches_set_id_patch_id_source_rank_tier_idx ON matches (set_id, patch_id, source_rank_tier);
CREATE INDEX matches_played_at_idx ON matches (played_at);

CREATE TABLE match_participants (
  match_id      text     NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  puuid         text     NOT NULL,
  placement     smallint NOT NULL,
  player_level  smallint,
  units         jsonb    NOT NULL,
  traits        jsonb    NOT NULL,
  PRIMARY KEY (match_id, puuid),
  CONSTRAINT match_participants_placement_check CHECK (placement BETWEEN 1 AND 8)
);

CREATE TABLE entity_stats (
  set_id         integer          NOT NULL,
  patch_id       text             NOT NULL,
  rank_tier      rank_tier        NOT NULL,
  kind           game_entity_kind NOT NULL,
  api_name       text             NOT NULL,
  variant        text             NOT NULL DEFAULT '',
  games          integer          NOT NULL DEFAULT 0,
  placement_sum  integer          NOT NULL DEFAULT 0,
  top1_count     integer          NOT NULL DEFAULT 0,
  top4_count     integer          NOT NULL DEFAULT 0,
  PRIMARY KEY (set_id, patch_id, rank_tier, kind, api_name, variant)
);

CREATE TABLE stat_totals (
  set_id             integer   NOT NULL,
  patch_id           text      NOT NULL,
  rank_tier          rank_tier NOT NULL,
  match_count        integer   NOT NULL DEFAULT 0,
  participant_count  integer   NOT NULL DEFAULT 0,
  PRIMARY KEY (set_id, patch_id, rank_tier)
);

CREATE TABLE site_settings (
  key         text  PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER site_settings_set_updated_at BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE etl_runs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job          text       NOT NULL,
  status       etl_status NOT NULL DEFAULT 'running',
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  summary      jsonb,
  error        text
);
CREATE INDEX etl_runs_job_started_at_idx ON etl_runs (job, started_at DESC);

CREATE UNLOGGED TABLE riot_cache (
  key         text  PRIMARY KEY,
  value       jsonb NOT NULL,
  expires_at  timestamptz NOT NULL
);
CREATE INDEX riot_cache_expires_at_idx ON riot_cache (expires_at);

CREATE UNLOGGED TABLE rate_limits (
  bucket        text        NOT NULL,
  window_start  timestamptz NOT NULL,
  hits          integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
