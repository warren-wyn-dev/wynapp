# Counted views

V1 accepts views only from authenticated active users through an explicit mutation after an authorized render. Every attempt is a raw `drop_view_events` row, while a unique `(drop_id,viewer_user_id,window_started_at)` counted bucket permits at most one counted view per UTC clock hour. HTTP GET never increments views. Endpoint actor limits provide burst protection; anonymous views are not counted.
