# Step 13 Clubs API

All mutations require consumer authentication, CSRF, and rate limiting. Responses use `{ data, request_id }`; inaccessible private resources return 404.

- `POST /v1/clubs` creates a Club transactionally.
- `GET /v1/clubs/search?q=` returns safe discovery results.
- `GET /v1/clubs/:slug` returns profile, rules, viewer role, and content capability.
- `POST /v1/clubs/:slug/join`; `DELETE /v1/clubs/:slug/membership` join/leave.
- `DELETE /v1/clubs/:slug/join-requests/:id` cancels a request.
- `POST .../:id/approve|reject` decides a request (Owner/Admin).
- `PATCH /v1/clubs/:slug/members/:userId/role` changes a non-owner role (Owner only in V1).
- `GET /v1/clubs/:slug/drops?sort=newest|popular&cursor=` returns the scoped feed.
- `GET /v1/clubs/:slug/trending` returns scoped ranking.

Rule, pin, moderation, and Club Drop mutation service endpoints are schema foundations in this revision and must remain disabled until their complete authorization tests land.
