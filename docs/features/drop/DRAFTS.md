# Drafts

Draft create/get/list/update/delete/publish operations are author-only. Draft reads deliberately return not-found to other users and drafts are never eligible for public surfaces. Publishing locks the aggregate and is retry safe.
