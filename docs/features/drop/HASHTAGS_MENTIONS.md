# Hashtags and mentions

Hashtags use Unicode letters/numbers/underscore, normalize with NFKC and lowercase, deduplicate, and are capped at 30 per Drop and 50 characters each. Mentions use normalized usernames, resolve authoritative active users, deduplicate, cap at 20, and omit blocked or invalid targets. No notification is sent in Step 9.
