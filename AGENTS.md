# AgentDocs Development Guide

## Skill Caching (rmmbr)

Skill content is cached via `rmmbr` with time-based TTLs:

- `fetchSkillContent(sourceUrl)` is wrapped with a **60-second TTL**. After 60s,
  the system re-fetches the sourceUrl's version from Tank. If the reference is
  **unversioned** (e.g. `tank:@uriva/agentdocs`), it discovers the latest
  version automatically. If **versioned** (e.g. `tank:@uriva/agentdocs@1.0.9`),
  it stays pinned.

- `fetchTankFileContent` calls for specific version+path combos are cached for
  **30 days** (immutable once published).

This means:

- Updating `installedAt` in the DB does **not** bust the cache. It's UI
  metadata only.
- Publishing a new Tank version + using unversioned sourceUrls = auto-upgrade
  within 60s.
- Versioned sourceUrls are intentionally sticky. To force them to upgrade,
  update the `sourceUrl` field in the DB.

## Publishing

CI publishes to Tank on push to `main` when `tank.json` version changes. Do not
run `tank publish` locally.
