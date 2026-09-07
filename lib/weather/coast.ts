import type { Region } from './districts';

export type CoastalPoint = {
  id: string;
  name: string;
  districtId: string;
  latitude: number;
  longitude: number;
  region: Region;
};

const point = (
  slug: string,
  name: string,
  districtId: string,
  latitude: number,
  longitude: number,
  region: Region = 'continent',
): CoastalPoint => ({
  id: `sea-${slug}`,
  name,
  districtId,
  latitude,
  longitude,
  region,
});

// Coordinates sit slightly offshore so the marine API resolves a sea cell.
export const COASTAL_POINTS: CoastalPoint[] = [
  point('viana', 'Viana do Castelo', 'PT-16', 41.7, -8.95),
  point('porto', 'Porto', 'PT-13', 41.15, -8.75),
  point('aveiro', 'Aveiro', 'PT-01', 40.64, -8.8),
  point('nazare', 'Nazaré', 'PT-10', 39.6, -9.1),
  point('cascais', 'Cascais', 'PT-11', 38.69, -9.47),
  point('sines', 'Sines', 'PT-15', 37.95, -8.95),
  point('sagres', 'Sagres', 'PT-08', 36.99, -8.99),
  point('faro', 'Faro', 'PT-08', 36.97, -7.9),
  point('funchal', 'Funchal', 'PT-30', 32.63, -16.95, 'madeira'),
  point('ponta-delgada', 'Ponta Delgada', 'PT-20', 37.73, -25.7, 'azores'),
];

export const seaPointForDistrict = (districtId: string) =>
  COASTAL_POINTS.find((p) => p.districtId === districtId);
