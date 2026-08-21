# Environments

`WYN_ENV` accepts `local`, `development`, `staging`, `production`, or `test`. Each deployable owns its runtime variables and deployment boundary. The checked-in examples contain names and blank values only.

Server database configuration is validated with Zod. Test runs reject production-like database URLs, and non-production runs reject production-named databases. Production, staging, development, and test must use isolated resources. Feature flags `clubs_enabled`, `chat_enabled`, `trending_enabled`, and `top100_enabled` are typed and default off; they never authorize an action.
