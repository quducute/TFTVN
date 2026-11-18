CREATE TABLE champion_roles (
  set_id             integer NOT NULL REFERENCES game_sets (id),
  champion_api_name  text    NOT NULL,
  role_api_name      text    NOT NULL,
  updated_by         bigint  REFERENCES users (id),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (set_id, champion_api_name)
);

CREATE INDEX champion_roles_set_id_role_api_name_idx ON champion_roles (set_id, role_api_name);

CREATE TRIGGER champion_roles_set_updated_at BEFORE UPDATE ON champion_roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
