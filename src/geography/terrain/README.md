# Inactive KBOS terrain package

These are transparent **render-data fragments**, not executable TypeScript, compressed data, or active game geometry. No runtime consumer or network loader imports them yet. Adapter/factual-metadata restoration and integrity-test integration are separate work units.

## Reassembly contract

1. Read `manifest.json`, then each listed index in its recorded order. Verify each index SHA256.
2. For every index record, concatenate its `.svgpath` fragments **without separators**, in the listed order. A fragment starts at an SVG `M`, `L` or `Z` command boundary; it need not be a complete standalone path.
3. Verify the reconstructed complete path SHA256 and place it at `pathIndex` within the named terrain layer. All original 190 land, 198 water and 3 neighbor paths are required.

The 401 raw fragments are each at most 30,000 bytes; the largest is 29,998 bytes. Eleven bounded index manifests preserve the complete ordering and per-path hashes. No vertices, rings or holes were omitted, encoded, simplified, clipped or re-quantized during partitioning. Compound paths retain the original even-odd hole semantics; do not stroke municipal boundaries or independently paint holes as solid land.

The original source is preserved at commit `a2f8c2e31e9902785dbdc54e22aad87998ffe234`. Its generated-source SHA256 is `b9046ff5f8f5f99ab044a5f8c14f08e0d3aaf955d7c06b8d3359abbf427c5995`. Combining reconstructed terrain with that original source envelope reproduces the exact original bytes/hash. The manifest's `factsSha256` identifies the separately retained factual metadata, not a missing terrain fragment; facts and adapter are intentionally deferred.

## Provenance and limits

Credit **MassGIS (Bureau of Geographic Information), Commonwealth of Massachusetts EOTSS; hydrography USGS, MassDEP, MassGIS**. See the [source notes](../SOURCES.md) for original service URLs, dates, datum, coverage and reuse limitations. The data use the original NAD83/GRS80 projection and 0.01-world-unit serialization precision (about 0.83 m), which is **not** a surveyed-accuracy claim.

Known land/water coverage is narrower than possible ultrawide fitted views. Later consumers must respect the separate coverage metadata and leave unverified space neutral; these positive terrain paths do not authorize classifying all surrounding space as ocean. This is an unofficial simplified game, **not for navigation or authoritative survey use**, with no agency endorsement.
