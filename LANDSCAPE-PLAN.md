# Landscape feature

Preserved baseline: `master` at `0df418f`. Feature branch: `feature/viewport-landscape`.

- [x] Commit the existing five-stage mountain study before feature edits.
- [x] Add a separate Landscape view with a canvas-sized camera and horizontal navigation.
- [x] Generate only 512-unit chunks intersecting the current viewport, after navigation settles.
- [x] Use deterministic world/cell/object seeds and shared plans at chunk boundaries.
- [x] Archive completed chunks in IndexedDB and keep only visible chunks in live memory.
- [x] Bound the archive and regenerate identical evicted chunks from their seed and coordinates.
- [x] Cancel stale work on navigation, seed changes, hidden tabs, and leaving Landscape.
- [x] Verify seam continuity, negative coordinates, direct jumps, archival restoration, bounded resident memory, idle behaviour, and the existing study.

Generation uses the upstream planner and drawing routines with coordinate-derived random streams. Lightweight neighbouring placement plans are needed to find objects that cross into a visible chunk; neighbouring artwork is not prefetched. The new landscape is deterministic independent of travel order, but its composition is not a pixel-for-pixel copy of upstream's sequential global random stream.

IndexedDB holds up to 64 compressed chunks, at most 2 MiB each. Every completed chunk is archived before being released from the worker. Archive failures are surfaced, and deterministic regeneration remains available. No server or background exploration is involved.
