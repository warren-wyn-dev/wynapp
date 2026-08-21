# Step 7 Social Graph API

All relationship mutations use the authenticated Consumer session as actor, require the session CSRF token and exact allowed Origin, return the standard request-ID envelope, and share the social mutation rate-limit bucket.

| Method | Route | Purpose |
|---|---|---|
| POST / DELETE | `/v1/users/:username/follow` | Follow, request, or unfollow |
| GET | `/v1/me/follow-requests` | Incoming pending requests |
| POST | `/v1/follow-requests/:id/approve` | Approve an owned request |
| POST | `/v1/follow-requests/:id/reject` | Reject an owned request |
| DELETE | `/v1/follow-requests/:id` | Cancel a request owned by requester |
| GET | `/v1/users/:username/followers` | Authorized cursor-paginated followers |
| GET | `/v1/users/:username/following` | Authorized cursor-paginated following |
| DELETE | `/v1/me/followers/:userId` | Remove the current user's follower |
| POST / DELETE | `/v1/users/:username/block` | Block or unblock |
| POST / DELETE | `/v1/users/:username/mute` | Mute or unmute |
| GET | `/v1/me/blocked` | Current user's outgoing blocks |
| GET | `/v1/me/muted` | Current user's private outgoing mutes |

Private profile and relationship-list authorization is enforced by the API; the UI is not an authorization boundary. Missing, blocked, and unauthorized relationship resources use non-enumerating unavailable responses.
