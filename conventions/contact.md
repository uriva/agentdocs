# Contact Convention

Contacts are regular encrypted documents with this JSON shape:

```json
{
  "kind": "contact",
  "title": "Jane Doe",
  "content": "Personal assistant instructions: prefer email for non-urgent tasks.",
  "contactDetails": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "1234567890",
    "slack": "U12345",
    "teams": "user@domain.com",
    "telegram": "@janedoe",
    "aliceAndBotPublicSignKey": "alice-and-bot-public-key"
  }
}
```

Rules:

- `kind` MUST be `"contact"`.
- `title` is the contact's name or display name.
- `content` can contain freeform markdown notes about the contact.
- `contactDetails` holds the structured contact fields previously handled by the DB.
