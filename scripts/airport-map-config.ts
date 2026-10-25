export interface MapBuildConfig {
  icao: string;
  snapshot: string;
  sourceSha256: string;
  bounds: [number, number, number, number];
  surfaces: { id: string; ends: [string, string]; endpointCaveat?: string }[];
  notice: string;
  attribution: string;
}

export const mdsdMapBuild: MapBuildConfig = {
  icao: 'MDSD', snapshot: '59574226b6df9417f5a7a8d03eeb6c7158a76168',
  sourceSha256: '7be01aa01204b13edde729d603505cf4c1661d274128b70a137c2285be728197',
  bounds: [-70.5, 17.4, -68.8, 19.5], surfaces: [{ id: '17/35', ends: ['17', '35'] }],
  notice: 'Generalized map only, not navigation or elevation relief. Terrain clipped to explicit coverage; no vertex simplification. OurAirports datum unspecified; coordinates assumed WGS84 for this approximate map. Historical pavement endpoints, unknown threshold displacement. Existing fixes, holds and approach guidance remain synthetic/simplified; no real LOC or magnetic variation asserted.',
  attribution: 'Natural Earth public-domain land5.1.1/lakes5.0.0, 1:10-million cartographic scale (not10m accuracy); OurAirports public-domain runway snapshot2024-12-30.',
};


export const mptoMapBuild: MapBuildConfig = {
  icao: 'MPTO', snapshot: '59574226b6df9417f5a7a8d03eeb6c7158a76168',
  sourceSha256: '7be01aa01204b13edde729d603505cf4c1661d274128b70a137c2285be728197',
  bounds: [-81, 7.5, -77.8, 10.7],
  surfaces: [{ id: '03L/21R', ends: ['03L', '21R'] }, { id: '03R/21L', ends: ['03R', '21L'] }],
  notice: 'Generalized map only, not navigation, elevation relief or canal engineering. Terrain clipped to explicit coverage; no vertex simplification. OurAirports datum unspecified; coordinates assumed WGS84 for this approximate historical map. Reference is the mean of four source endpoints, not an official ARP. Approximate endpoint spans, unknown threshold displacement. Existing fixes, holds and approach guidance remain synthetic/simplified; no real LOC or magnetic variation asserted.',
  attribution: 'Natural Earth public-domain land5.1.1/lakes5.0.0, 1:10-million cartographic scale (not10m accuracy); OurAirports public-domain runway snapshot2024-12-30.',
};
