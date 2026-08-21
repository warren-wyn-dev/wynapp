# Drop media

Drop images use Step 8 `DROP_IMAGE` assets. PostgreSQL validates owner, `READY` state, purpose, duplicate asset, unique position 0–8, and a maximum of nine under an advisory lock plus Drop row lock. Media structure is immutable after publish in Step 9; deleting a Drop retains references safely.
