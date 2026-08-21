# Roles and permissions

`OWNER > ADMIN > MODERATOR > MEMBER`. Authorization is server-side and capability based. Owner alone changes roles in V1; Admin handles requests; moderators may moderate content when the endpoint is enabled. Database triggers prevent deleting/demoting an active Owner. Ownership transfer and Club deletion are deliberately deferred for Founder approval.
