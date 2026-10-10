# Decisions log

Non-obvious decisions (two or more viable options with a trade-off). Newest first. Format: date · decision · options · why.

- **2026-10-10 · World layout is a square grid of facing rooms.** Options: rooms in a single strip along the corridor (previous layout) vs. a compact grid with shared aisles. Chosen: grid — the whole floor fits one isometric view, rooms read as neighbours, and new rooms slot in without stretching the map. Trade-off: flow streams and the scooter route need re-routing through aisles.
- **2026-10-10 · n8n runs the daily ingest outside Forge.** Options: Forge triggers ingestion vs. an external scheduler (n8n/cron) runs `npm run ingest` and publishes a snapshot. Chosen: external — the browser never holds tokens and the app stays a static PWA. Trade-off: freshness is daily, not live.
- **2026-10 (earlier) · Fronts ≠ squads (many-to-many).** A front is delivered only with production evidence from the tracker or Git deployments; the planning sheet's "Finalizado" is only a declaration. Trade-off: fronts without connected evidence show as "sem evidência" instead of done.
