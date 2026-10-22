# KBOS geographic facts and terrain

The reviewed first slice supplies pure projection/types/headings; lossless terrain and adapter/loader are separate units. GamePage now activates the shared geographic airport locally for KBOS only; review and remote delivery remain pending. The original inactive implementation remains preserved on `codex/kbos-geographic-radar-original`; its exact facts and geometry are reconstructed and checked without reintroducing the giant executable terrain literal. This is an unofficial simplified game. It is not navigation data, an authoritative survey, a certified procedure, or an agency-endorsed product. The canonical airport inventory is unchanged.

## Source boundary

The independently structured aviation subset contains coordinates, identifiers, elevation, source courses and explicit localizer limitations from the FAA NASR cycle effective **October 1, 2026**:

- [Airport facts](https://nfdc.faa.gov/webContent/28DaySub/extra/01_Oct_2026_APT_CSV.zip)
- [Fix facts](https://nfdc.faa.gov/webContent/28DaySub/extra/01_Oct_2026_FIX_CSV.zip)
- [Hold-existence facts](https://nfdc.faa.gov/webContent/28DaySub/extra/01_Oct_2026_HPF_CSV.zip)
- [Localizer facts](https://nfdc.faa.gov/webContent/28DaySub/extra/01_Oct_2026_ILS_CSV.zip)

No raw CSV tables, original schema, charts, source documentation, full compilation, or mockup DEMO aircraft are distributed here. This narrow factual extraction does **not** assert a blanket FAA/NASR license or CC0 status. If a concrete source restriction emerges, pause affected incorporation. Source archive and geometry hashes are retained in generated metadata.

Terrain credit: **MassGIS (Bureau of Geographic Information), Commonwealth of Massachusetts EOTSS; hydrography USGS, MassDEP, MassGIS**. See the [selected land item](https://www.arcgis.com/home/item.html?id=33061b8aef6848e1aeb9a4c059d62ed9) and [MassGIS reuse information](https://www.mass.gov/info-details/about-massgis). Source dates vary: municipal metadata May 2024; hydrography metadata December 2019, hosted update April 22, 2026. These dates do not claim new field surveys. Geodata retrieval was October 21, 2026; it is stored separately from the FAA effective cycle.

## Processing and limitations

Inputs are explicitly **NAD83 / EPSG:4269**, longitude/latitude, not WGS84 GeoJSON. The GRS80 local azimuthal-equidistant projection uses ellipsoidal inverse distance/azimuth from the FAA airport reference point. World coordinates are `500 + eastNM * 22.4`, `500 - northNM * 22.4`. The 35-NM shortest span corresponds to half-range 392; no anisotropic fit or operational coordinate relocation occurs.

Terrain is preprojected offline to SVG paths. All selected source rings and holes remain; no union, clipping, hole deletion, or additional simplification is applied. Source service generalization was 0.00015 degrees with five-decimal coordinate precision. Path serialization rounds to 0.01 world units (about 0.83 m); this is storage precision, **not** an accuracy claim. A trial 0.15-world simplification saved only about 0.24% and was rejected because topology risk outweighed the benefit.

Land query bounds are `[-71.8, 41.8, -70.2, 42.9]`; water bounds are `[-71.6, 42.01, -70.4, 42.72]`. Their sampled projected coverage rings are separate metadata, not land/water polygons. Selected full source features can extend outside query bounds. Consumers must clip classification to verified coverage and show unknown space neutrally, not assume ocean or land; never stretch/cap the frozen camera to conceal missing coverage. Municipal fill should be a compound even-odd path without municipal strokes; do not paint neighbors over detailed Massachusetts terrain.

Six physical runway surfaces retain actual endpoints and displaced thresholds, separate from the four existing operative IDs. Five localizers retain source antenna/course/status/remarks. 22L is reference-only. 15R is offset; 33L has a restricted-side remark, not an automatic unavailability flag. Illustrative 8/10-NM lines are not RF coverage, approach authorization, capture volumes or certified glideslope simulation.

The nine inner fixes alone form the navigation pool. SOSYO/WHYBE are noninteractive context outside the common portrait core. WAXEN/WINNI record verified holding existence only; no hold paths or new hold navigation are inferred. Magnetic variation is the source 15°W value, not a current magnetic-model survey: internal true = magnetic − 15; display magnetic = true + 15. Legacy airports remain no-op conversions.

## Reproduce

For the standalone contract/math slice, run from the repository root:

```sh
npm test -- src/geography/projection.test.ts --maxWorkers=1
```

The raw package stores transparent SVG command fragments at most 30,000 bytes each. The Vite loader reassembles manifest → indexes → fragments by pathIndex and rejects missing, duplicate, gapped or unexpected fragment inventories. CI integrity tests check index/path/facts hashes and reconstruct the original three-line generated source, including its property order, to SHA256 `b9046ff5f8f5f99ab044a5f8c14f08e0d3aaf955d7c06b8d3359abbf427c5995`. GamePage imports the adapter for KBOS; other airports retain their canonical objects and heading conventions.

### Generator safety

The original 90-line offline generator is preserved unchanged. **Never run it from the repository root:** its relative output path would overwrite the new loader. Reproduce only in a separate staging directory:

```sh
REPO=/absolute/path/to/repository
INPUT=/absolute/path/to/kbos-composition/data
STAGING=$(mktemp -d)
mkdir -p "$STAGING/src/geography"
(cd "$STAGING" && node --experimental-strip-types "$REPO/scripts/build-kbos-geography.ts" "$INPUT")
```

The staging output is for comparison/extraction, not a replacement runtime module. Original approved mockups and input artifacts remain unchanged. Activation and local end-to-end QA remain separate tasks.

## Local navigation integration

For KBOS only, runway pavement/departure geometry, displaced landing thresholds and localizer antenna/course frames are separate. Capture/feedback/forecast/render consumers share the same true-coordinate frame. Numeric console and planned-control headings are magnetic at the input/output boundary; mouse vectors and geometry-derived bearings remain true internally. The source 33L unusable-left-side restriction is checked without disabling the whole localizer; 22L stays reference-only.

The simplified game follows the LOC axis and then aims at the actual displaced threshold within the last nautical mile, including offset15R. This visual transition is **not a published instrument procedure or a certified glideslope model**; the existing game descent rates remain. A four-world-unit threshold arrival tolerance replaces the legacy30-unit center tolerance for KBOS only, avoiding fictitious landings over a central map point. The computed8-NM vector target stays within the common portrait core and is not a published navigation fix. Traffic rates/goals and operational IDs are unchanged; new geographic transit distances can alter workload.
