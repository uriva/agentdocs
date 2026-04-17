# Ticket Convention

Tickets are regular encrypted documents with this JSON shape:

```json
{
  "kind": "ticket",
  "title": "Fix auth timeout",
  "content": "Description and acceptance criteria",
  "status": "open",
  "priority": "high",
  "assigneeIdentityId": "<identity-id>",
  "labels": ["bug", "auth"],
  "comments": [
    {
      "authorIdentityId": "<identity-id>",
      "timestamp": "2026-04-17T12:34:56.000Z",
      "content": "Investigating token refresh path"
    }
  ]
}
```

Rules:

- `kind` MUST be `"ticket"`.
- `status` SHOULD be one of: `open`, `in_progress`, `closed`.
- `priority` SHOULD be one of: `low`, `medium`, `high`, `urgent`.
- `comments` are embedded; append by writing a new full snapshot.
- All fields are encrypted in content. No ticket metadata is plaintext server-side.
