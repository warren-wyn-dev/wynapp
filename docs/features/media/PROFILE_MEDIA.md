# Profile Media

Avatar and cover pickers share preview, progress, processing, retry, remove and accessible status UI. Attachment endpoints accept only the authenticated owner's `READY` asset with exactly `PROFILE_AVATAR` or `PROFILE_COVER` purpose. Foreign assets and wrong-purpose assets return a non-enumerating unavailable response. Profile visibility remains governed by Step 7; public profile serialization must expose only attached processed URLs, never quarantine keys.
