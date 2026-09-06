export type Region = 'continent' | 'madeira' | 'azores';
export type District = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  region: Region;
  timezone: string;
};
const continent = (
  code: string,
  name: string,
  latitude: number,
  longitude: number,
): District => ({
  id: `PT-${code}`,
  name,
  latitude,
  longitude,
  region: 'continent',
  timezone: 'Europe/Lisbon',
});
// Coordinates represent district capitals, not district-wide averages.
export const DISTRICTS: District[] = [
  continent('01', 'Aveiro', 40.64, -8.65),
  continent('02', 'Beja', 38.02, -7.86),
  continent('03', 'Braga', 41.55, -8.43),
  continent('04', 'Bragança', 41.81, -6.76),
  continent('05', 'Castelo Branco', 39.82, -7.49),
  continent('06', 'Coimbra', 40.21, -8.43),
  continent('07', 'Évora', 38.57, -7.91),
  continent('08', 'Faro', 37.02, -7.93),
  continent('09', 'Guarda', 40.54, -7.27),
  continent('10', 'Leiria', 39.74, -8.81),
  continent('11', 'Lisboa', 38.72, -9.14),
  continent('12', 'Portalegre', 39.29, -7.43),
  continent('13', 'Porto', 41.15, -8.61),
  continent('14', 'Santarém', 39.24, -8.69),
  continent('15', 'Setúbal', 38.52, -8.89),
  continent('16', 'Viana do Castelo', 41.69, -8.83),
  continent('17', 'Vila Real', 41.3, -7.74),
  continent('18', 'Viseu', 40.66, -7.91),
  {
    id: 'PT-30',
    name: 'Madeira',
    latitude: 32.65,
    longitude: -16.91,
    region: 'madeira',
    timezone: 'Atlantic/Madeira',
  },
  {
    id: 'PT-20',
    name: 'Açores',
    latitude: 37.74,
    longitude: -25.67,
    region: 'azores',
    timezone: 'Atlantic/Azores',
  },
];
export const REGION_NAMES: Record<Region, string> = {
  continent: 'Continente',
  madeira: 'Madeira',
  azores: 'Açores',
};
