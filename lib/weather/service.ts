import { DISTRICTS } from './districts';
import { COASTAL_POINTS } from './coast';
import { fetchMetNoForecasts } from './met-no';
import type { Forecast, WeatherResponse } from './types';

export const HOUR_MS = 60 * 60 * 1000;
export const FAILURE_COOLDOWN_MS = 60 * 1000;
export const MAX_FAILURE_COOLDOWN_MS = 15 * 60 * 1000;
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

export function marineUrl() {
  const query = new URLSearchParams({
    latitude: COASTAL_POINTS.map((p) => p.latitude).join(','),
    longitude: COASTAL_POINTS.map((p) => p.longitude).join(','),
    current: 'sea_surface_temperature',
    timeformat: 'unixtime',
    timezone: 'GMT',
  });
  return `https://marine-api.open-meteo.com/v1/marine?${query}`;
}

export function seaFromPayload(
  payload: unknown,
): Record<string, number | null> {
  if (!Array.isArray(payload) || payload.length !== COASTAL_POINTS.length)
    throw new Error('Invalid marine provider response');
  const entries = payload.map((point, index) => {
    const temperature = (point as { current?: { sea_surface_temperature?: unknown } })
      ?.current?.sea_surface_temperature;
    if (
      temperature !== null &&
      (typeof temperature !== 'number' || !Number.isFinite(temperature))
    )
      throw new Error('Invalid marine provider response');
    return [COASTAL_POINTS[index].id, temperature] as const;
  });
  return Object.fromEntries(entries);
}

async function fetchSeaTemperatures(
  fetcher: typeof fetch,
): Promise<Record<string, number | null> | undefined> {
  try {
    const response = await fetcher(marineUrl(), {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return undefined;
    return seaFromPayload(await response.json());
  } catch {
    return undefined;
  }
}

/** Shared by all visitors in an isolate; concurrent requests share one fetch. */
export function createWeatherService(
  fetcher: typeof fetch = fetch,
  now = Date.now,
) {
  let cached: WeatherResponse | undefined;
  let pending: Promise<WeatherResponse> | undefined;
  let consecutiveFailures = 0;
  let retryAfter = 0;
  const scheduleRetry = () => {
    consecutiveFailures++;
    retryAfter =
      now() +
      Math.min(
        FAILURE_COOLDOWN_MS * 2 ** (consecutiveFailures - 1),
        MAX_FAILURE_COOLDOWN_MS,
      );
  };
  return async function getWeather(): Promise<WeatherResponse> {
    if (cached && cached.expiresAt > now()) return cached;
    if (pending) return pending;
    // During a failure cooldown, never touch the upstream: serve the last
    // good snapshot if one exists, otherwise fail fast.
    if (now() < retryAfter) {
      if (cached) return cached;
      throw new Error('Weather provider temporarily unavailable');
    }
    pending = (async () => {
      const sea = fetchSeaTemperatures(fetcher);
      const response = await fetcher(forecastUrl(), {
        signal: AbortSignal.timeout(18000),
      });
      let fresh: WeatherResponse;
      if (response.status === 429 || response.status === 403) {
        fresh = await fetchMetNoForecasts(fetcher, now());
      } else {
        if (!response.ok)
          throw new Error(`Weather provider returned ${response.status}`);
        const payload: unknown = await response.json();
        fresh = weatherResponseFromPayload(payload, now());
      }
      const seaTemperatures = await sea;
      if (seaTemperatures) fresh.sea = seaTemperatures;
      cached = fresh;
      return cached;
    })();
    try {
      const fresh = await pending;
      consecutiveFailures = 0;
      retryAfter = 0;
      return fresh;
    } catch (error) {
      scheduleRetry();
      if (cached) return cached;
      throw error;
    } finally {
      pending = undefined;
    }
  };
}
