# Registration

`POST /v1/auth/register` validates email, a 12–128 character password containing upper/lowercase, number and symbol, username, and display name. One transaction creates user, credential, profile, PUBLIC privacy default, hashed verification token, and outbox facts. Database unique indexes resolve races. Conflict responses do not identify which identifier exists.
