import { DISTRICTS } from './districts';
import { fetchMetNoForecasts } from './met-no';
import type { Forecast, WeatherResponse } from './types';

export const HOUR_MS = 60 * 60 * 1000;
const numericArray = (value: unknown): value is (number | null)[] =>
  Array.isArray(value) &&
  value.every(
    (n) => n === null || (typeof n === 'number' && Number.isFinite(n)),
  );
export function validateForecast(value: unknown): value is Forecast {
  if (!value || typeof value !== 'object') return false;
  const f = value as Forecast;
  if (!f.current || !f.hourly || !f.daily || !Number.isFinite(f.current.time))
    return false;
  if (
    !Array.isArray(f.hourly.time) ||
    f.hourly.time.length < 24 ||
    !f.hourly.time.every(Number.isFinite)
  )
    return false;
  if (
    !Array.isArray(f.daily.time) ||
    f.daily.time.length < 7 ||
    !f.daily.time.every(Number.isFinite)
  )
    return false;
  const currentFields = [
    'temperature_2m',
    'apparent_temperature',
    'relative_humidity_2m',
    'precipitation',
    'weather_code',
    'wind_speed_10m',
    'wind_direction_10m',
    'is_day',
  ] as const;
  if (
    !currentFields.every(
      (key) => f.current[key] === null || Number.isFinite(f.current[key]),
    )
  )
    return false;
  const hourlyFields = [
    'temperature_2m',
    'apparent_temperature',
    'relative_humidity_2m',
    'precipitation_probability',
    'weather_code',
    'wind_speed_10m',
    'is_day',
  ] as const;
  const dailyFields = [
    'temperature_2m_max',
    'temperature_2m_min',
    'weather_code',
    'precipitation_probability_max',
    'sunrise',
    'sunset',
    'uv_index_max',
  ] as const;
  return (
    hourlyFields.every(
      (key) =>
        numericArray(f.hourly[key]) &&
        f.hourly[key].length === f.hourly.time.length,
    ) &&
    dailyFields.every(
      (key) =>
        numericArray(f.daily[key]) &&
        f.daily[key].length === f.daily.time.length,
    )
  );
}

export function forecastUrl() {
  const query = new URLSearchParams({
    latitude: DISTRICTS.map((d) => d.latitude).join(','),
    longitude: DISTRICTS.map((d) => d.longitude).join(','),
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day',
    hourly:
      'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,is_day',
    daily:
      'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset,uv_index_max',
    forecast_days: '7',
    timezone: 'auto',
    timeformat: 'unixtime',
    wind_speed_unit: 'kmh',
    temperature_unit: 'celsius',
  });
  return `https://api.open-meteo.com/v1/forecast?${query}`;
}

export function weatherResponseFromPayload(
  payload: unknown,
  fetchedAt = Date.now(),
): WeatherResponse {
  if (
    !Array.isArray(payload) ||
    payload.length !== DISTRICTS.length ||
    !payload.every(validateForecast)
  )
    throw new Error('Invalid weather provider response');
  return {
    source: 'open-meteo',
    fetchedAt,
    expiresAt: fetchedAt + HOUR_MS,
    districts: Object.fromEntries(
      DISTRICTS.map((district, index) => [district.id, payload[index]]),
    ),
  };
}

/** Shared by all visitors in an isolate; concurrent requests share one fetch. */
export function createWeatherService(
  fetcher: typeof fetch = fetch,
  now = Date.now,
) {
  let cached: WeatherResponse | undefined;
  let pending: Promise<WeatherResponse> | undefined;
  return async function getWeather(): Promise<WeatherResponse> {
    if (cached && cached.expiresAt > now()) return cached;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetcher(forecastUrl(), {
        signal: AbortSignal.timeout(18000),
      });
      if (response.status === 429 || response.status === 403) {
        cached = await fetchMetNoForecasts(fetcher, now());
        return cached;
      }
      if (!response.ok)
        throw new Error(`Weather provider returned ${response.status}`);
      const payload: unknown = await response.json();
      cached = weatherResponseFromPayload(payload, now());
      return cached;
    })();
    try {
      return await pending;
    } finally {
      pending = undefined;
    }
  };
}
