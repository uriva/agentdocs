# Spreadsheet Convention

Spreadsheets are regular encrypted documents with this JSON shape:

```json
{
  "kind": "spreadsheet",
  "title": "Q2 Metrics",
  "data": {
    "cells": {
      "A1": { "v": "Metric" },
      "B1": { "v": "Value" },
      "A2": { "v": "MRR" },
      "B2": { "v": "120000" }
    },
    "colWidths": {
      "A": 180,
      "B": 120
    }
  }
}
```

Rules:

- `kind` MUST be `"spreadsheet"`.
- `title` is the sheet name.
- `data.cells` uses A1-style keys.
- Rename by writing a new snapshot with updated `title`.
