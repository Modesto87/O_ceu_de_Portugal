import { DISTRICTS } from './districts';
import type { Forecast, WeatherResponse } from './types';

const HOUR_MS = 60 * 60 * 1000;
const USER_AGENT =
  'O-ceu-de-Portugal/1.0 github.com/Modesto87/O_ceu_de_Portugal';

type MetNoDetails = {
  air_temperature?: number;
  apparent_air_temperature?: number;
  relative_humidity?: number;
  ultraviolet_index_clear_sky?: number;
  wind_from_direction?: number;
  wind_speed?: number;
  precipitation_amount?: number;
};

type MetNoPeriod = {
  summary?: { symbol_code?: string };
  details?: MetNoDetails;
};

type MetNoPoint = {
  time: string;
  data: {
    instant: { details: MetNoDetails };
    next_1_hours?: MetNoPeriod;
    next_6_hours?: MetNoPeriod;
    next_12_hours?: MetNoPeriod;
  };
};

type MetNoPayload = {
  properties?: {
    timeseries?: MetNoPoint[];
  };
};

const asNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function symbol(point: MetNoPoint) {
  return (
    point.data.next_1_hours?.summary?.symbol_code ??
    point.data.next_6_hours?.summary?.symbol_code ??
    point.data.next_12_hours?.summary?.symbol_code ??
    ''
  );
}

export function metNoSymbolToWmo(value: string) {
  const code = value.replace(/_(day|night|polartwilight)$/, '');
  if (code.includes('thunder')) return code.includes('hail') ? 99 : 95;
  if (code.includes('heavysnowshowers')) return 86;
  if (code.includes('snowshowers')) return 85;
  if (code.includes('heavysnow')) return 75;
  if (code.includes('lightsnow')) return 71;
  if (code.includes('snow')) return 73;
  if (code.includes('heavysleet')) return 67;
  if (code.includes('sleet')) return 66;
  if (code.includes('heavyrainshowers')) return 82;
  if (code.includes('rainshowers')) return 81;
  if (code.includes('lightrainshowers')) return 80;
  if (code.includes('heavyrain')) return 65;
  if (code.includes('lightrain')) return 61;
  if (code.includes('rain')) return 63;
  if (code.includes('fog')) return 45;
  if (code.includes('partlycloudy')) return 2;
  if (code.includes('cloudy')) return 3;
  if (code.includes('fair')) return 1;
  return 0;
}

function rainChance(point: MetNoPoint, weatherCode: number) {
  const amount =
    point.data.next_1_hours?.details?.precipitation_amount ??
    point.data.next_6_hours?.details?.precipitation_amount ??
    0;
  if (amount >= 2) return 90;
  if (amount > 0) return 75;
  if (weatherCode >= 51) return 55;
  return 0;
}

function dateKey(time: number, timezone: string) {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).format(time * 1000);
}

// Solar calculation adapted from the public astronomical equations used by
// SunCalc; accurate enough for display and independent of another API call.
export function solarTimes(day: string, latitude: number, longitude: number) {
  const radians = Math.PI / 180;
  const [year, month, date] = day.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, date, 12);
  const julian = timestamp / 86400000 - 0.5 + 2440588;
  const days = julian - 2451545;
  const lw = -longitude * radians;
  const phi = latitude * radians;
  const cycle = Math.round(days - 0.0009 - lw / (2 * Math.PI));
  const transitApprox = 0.0009 + lw / (2 * Math.PI) + cycle;
  const meanAnomaly =
    radians * (357.5291 + 0.98560028 * transitApprox);
  const equation =
    radians *
    (1.9148 * Math.sin(meanAnomaly) +
      0.02 * Math.sin(2 * meanAnomaly) +
      0.0003 * Math.sin(3 * meanAnomaly));
  const longitudeSun =
    meanAnomaly + equation + radians * 102.9372 + Math.PI;
  const declination = Math.asin(
    Math.sin(longitudeSun) * Math.sin(radians * 23.4397),
  );
  const transit =
    2451545 +
    transitApprox +
    0.0053 * Math.sin(meanAnomaly) -
    0.0069 * Math.sin(2 * longitudeSun);
  const hourAngle = Math.acos(
    (Math.sin(radians * -0.833) -
      Math.sin(phi) * Math.sin(declination)) /
      (Math.cos(phi) * Math.cos(declination)),
  );
  const sunset = transit + hourAngle / (2 * Math.PI);
  const sunrise = transit - hourAngle / (2 * Math.PI);
  const toUnix = (value: number) => (value - 2440587.5) * 86400;
  return [toUnix(sunrise), toUnix(sunset)] as const;
}

function toForecast(
  payload: MetNoPayload,
  district: (typeof DISTRICTS)[number],
): Forecast {
  const points = payload.properties?.timeseries;
  if (!Array.isArray(points) || points.length < 24)
    throw new Error(`Invalid MET Norway response for ${district.id}`);
  const times = points.map((point) => Date.parse(point.time) / 1000);
  if (times.some((time) => !Number.isFinite(time)))
    throw new Error(`Invalid MET Norway timestamps for ${district.id}`);
  const codes = points.map((point) => metNoSymbolToWmo(symbol(point)));
  const allDayKeys = [
    ...new Set(times.map((time) => dateKey(time, district.timezone))),
  ];
  const dayKeys = allDayKeys.slice(0, 7);
  if (dayKeys.length < 7)
    throw new Error(`Incomplete MET Norway forecast for ${district.id}`);
  const sunByDay = Object.fromEntries(
    allDayKeys.map((day) => [
      day,
      solarTimes(day, district.latitude, district.longitude),
    ]),
  );
  const isDay = times.map((time, index) => {
    const value = symbol(points[index]);
    if (value.endsWith('_day')) return 1;
    if (value.endsWith('_night')) return 0;
    const [rise, set] = sunByDay[dateKey(time, district.timezone)];
    return time >= rise && time < set ? 1 : 0;
  });
  const temperatures = points.map((point) =>
    asNumber(point.data.instant.details.air_temperature),
  );
  const apparent = points.map(
    (point, index) =>
      asNumber(point.data.instant.details.apparent_air_temperature) ??
      temperatures[index],
  );
  const humidity = points.map((point) =>
    asNumber(point.data.instant.details.relative_humidity),
  );
  const wind = points.map((point) => {
    const value = asNumber(point.data.instant.details.wind_speed);
    return value === null ? null : value * 3.6;
  });
  const rain = points.map((point, index) => rainChance(point, codes[index]));
  const first = points[0];
  const firstDetails = first.data.instant.details;
  const dayIndexes = dayKeys.map((day) =>
    times.flatMap((time, index) =>
      dateKey(time, district.timezone) === day ? [index] : [],
    ),
  );
  const values = (indexes: number[], series: (number | null)[]) =>
    indexes.flatMap((index) => {
      const value = series[index];
      return value === null ? [] : [value];
    });

  return {
    current: {
      time: times[0],
      temperature_2m: temperatures[0],
      apparent_temperature: apparent[0],
      relative_humidity_2m: humidity[0],
      precipitation: asNumber(
        first.data.next_1_hours?.details?.precipitation_amount,
      ),
      weather_code: codes[0],
      wind_speed_10m: wind[0],
      wind_direction_10m: asNumber(firstDetails.wind_from_direction),
      is_day: isDay[0],
    },
    hourly: {
      time: times,
      temperature_2m: temperatures,
      apparent_temperature: apparent,
      relative_humidity_2m: humidity,
      precipitation_probability: rain,
      weather_code: codes,
      wind_speed_10m: wind,
      is_day: isDay,
    },
    daily: {
      time: dayIndexes.map((indexes) => times[indexes[0]]),
      temperature_2m_max: dayIndexes.map((indexes) => {
        const found = values(indexes, temperatures);
        return found.length ? Math.max(...found) : null;
      }),
      temperature_2m_min: dayIndexes.map((indexes) => {
        const found = values(indexes, temperatures);
        return found.length ? Math.min(...found) : null;
      }),
      weather_code: dayIndexes.map((indexes) =>
        Math.max(...indexes.map((index) => codes[index])),
      ),
      precipitation_probability_max: dayIndexes.map((indexes) =>
        Math.max(...indexes.map((index) => rain[index])),
      ),
      sunrise: dayKeys.map((day) => sunByDay[day][0]),
      sunset: dayKeys.map((day) => sunByDay[day][1]),
      uv_index_max: dayIndexes.map((indexes) => {
        const found = indexes.flatMap((index) => {
          const value = asNumber(
            points[index].data.instant.details.ultraviolet_index_clear_sky,
          );
          return value === null ? [] : [value];
        });
        return found.length ? Math.max(...found) : null;
      }),
    },
  };
}

export async function fetchMetNoForecasts(
  fetcher: typeof fetch,
  fetchedAt: number,
): Promise<WeatherResponse> {
  const payloads: MetNoPayload[] = [];
  for (let index = 0; index < DISTRICTS.length; index += 5) {
    const batch = await Promise.all(
      DISTRICTS.slice(index, index + 5).map(async (district) => {
        const url = new URL(
          'https://api.met.no/weatherapi/locationforecast/2.0/complete',
        );
        url.searchParams.set('lat', district.latitude.toFixed(4));
        url.searchParams.set('lon', district.longitude.toFixed(4));
        const response = await fetcher(url, {
          headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(18000),
        });
        if (!response.ok)
          throw new Error(`MET Norway returned ${response.status}`);
        return (await response.json()) as MetNoPayload;
      }),
    );
    payloads.push(...batch);
  }
  return {
    source: 'met-no',
    fetchedAt,
    expiresAt: fetchedAt + HOUR_MS,
    districts: Object.fromEntries(
      DISTRICTS.map((district, index) => [
        district.id,
        toForecast(payloads[index], district),
      ]),
    ),
  };
}
