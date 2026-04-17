# Document Convention

Use this JSON shape for general text documents:

```json
{
  "kind": "doc",
  "title": "Architecture Overview",
  "content": "# Heading\n\nMarkdown body..."
}
```

Rules:

- `kind` MUST be `"doc"`.
- `title` is the display title.
- `content` is markdown (string).
- Rename by writing a new snapshot with a new `title`.
