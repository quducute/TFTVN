ALTER TABLE comps DROP CONSTRAINT comps_meta_patch_id_fkey;

ALTER TABLE patches DROP CONSTRAINT patches_pkey;
ALTER TABLE patches ADD CONSTRAINT patches_pkey PRIMARY KEY (set_id, id);
DROP INDEX patches_set_id_idx;

ALTER TABLE comps
  ADD CONSTRAINT comps_set_id_meta_patch_id_fkey
  FOREIGN KEY (set_id, meta_patch_id) REFERENCES patches (set_id, id);
