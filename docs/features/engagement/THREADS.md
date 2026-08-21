# Threads

`parent_comment_id` and the composite foreign key `(parent_comment_id,drop_id) → (id,drop_id)` guarantee that a reply belongs to the same Drop. Inserts only reference an existing non-deleted parent, so cycles cannot be created. Storage supports trees; the mobile UI flattens replies with one practical indentation level.
