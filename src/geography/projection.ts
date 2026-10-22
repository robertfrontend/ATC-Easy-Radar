import type { GeographicPoint, WorldPoint } from './types';

// Local NAD83/GRS80 azimuthal equidistant projection; never screen-fit coordinates.
const a = 6378137;
const f = 1 / 298.257222101;
const b = a * (1 - f);
const rad = value => value * Math.PI / 180;
const NM = 1852;
export function inverseNad83(origin: GeographicPoint, point: GeographicPoint) {
  for (const value of [origin, point]) {
    if (!Number.isFinite(value.longitude) || !Number.isFinite(value.latitude) || Math.abs(value.longitude) > 180 || Math.abs(value.latitude) > 90) throw new RangeError('Invalid NAD83 longitude/latitude');
  }
  const { longitude: lon1, latitude: lat1 } = origin;
  const { longitude: lon2, latitude: lat2 } = point;
  const L = rad(lon2 - lon1);
  const U1 = Math.atan((1 - f) * Math.tan(rad(lat1)));
  const U2 = Math.atan((1 - f) * Math.tan(rad(lat2)));
  const s1 = Math.sin(U1), c1 = Math.cos(U1), s2 = Math.sin(U2), c2 = Math.cos(U2);
  let lambda = L, sinSigma, cosSigma, sigma, sinAlpha, cosSqAlpha, cos2SigmaM;
  let converged = false;
  for (let i = 0; i < 100; i++) {
    const sl = Math.sin(lambda), cl = Math.cos(lambda);
    sinSigma = Math.hypot(c2 * sl, c1 * s2 - s1 * c2 * cl);
    cosSigma = s1 * s2 + c1 * c2 * cl;
    if (sinSigma < 1e-15) {
      if (cosSigma < 0) throw new RangeError('Antipodal projection is unsupported');
      return { distanceMetres: 0, trueBearingDegrees: 0 };
    }
    sigma = Math.atan2(sinSigma, cosSigma);
    sinAlpha = c1 * c2 * sl / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSqAlpha < 1e-15 ? 0 : cosSigma - 2 * s1 * s2 / cosSqAlpha;
    const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    const next = L + (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
    if (Math.abs(next - lambda) < 1e-12) { lambda = next; converged = true; break; }
    lambda = next;
  }
  if (!converged) throw new Error('Vincenty inverse did not converge');
  const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
  const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const delta = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM ** 2) - B / 6 * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)));
  return { distanceMetres: b * A * (sigma - delta), trueBearingDegrees: (Math.atan2(c2 * Math.sin(lambda), c1 * s2 - s1 * c2 * Math.cos(lambda)) * 180 / Math.PI + 360) % 360 };
}

export function projectNad83(origin: GeographicPoint, point: GeographicPoint): WorldPoint {
  const { distanceMetres, trueBearingDegrees } = inverseNad83(origin, point);
  const distance = distanceMetres / NM * 22.4;
  return { x: 500 + distance * Math.sin(rad(trueBearingDegrees)), y: 500 - distance * Math.cos(rad(trueBearingDegrees)) };
}
