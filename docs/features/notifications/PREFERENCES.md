# Preferences

Likes, comments, replies, ReDrops, follows, follow requests, mentions, and trending each default to in-app enabled and push disabled. Missing rows mean defaults. The worker reads current preferences at processing time. `SYSTEM` in-app delivery is mandatory and the database/API reject disabling it; push remains optional. Mute is not a security boundary and produces no observable signal.
