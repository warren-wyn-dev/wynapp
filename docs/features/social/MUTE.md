# Mute

Mute is an idempotent, private preference owned by the muting user. It does not remove follows, authorize or deny access, emit a user-facing event, or notify the target. Only `/v1/me/muted` exposes the current user's outgoing mute choices; no API exposes who muted a target.
