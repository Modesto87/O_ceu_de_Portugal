import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DISTRICTS } from '../lib/weather/districts';
import { COASTAL_POINTS } from '../lib/weather/coast';
import {
  createWeatherService,
  FAILURE_COOLDOWN_MS,
  HOUR_MS,
  validateForecast,
  forecastUrl,
  marineUrl,
  seaFromPayload,
} from '../lib/weather/service';
import { condition, hour, hourIndex, value } from '../lib/weather/format';
import { metricColor } from '../lib/weather/colors';
import { recommendClothing } from '../lib/weather/clothing';
import { metNoSymbolToWmo, solarTimes } from '../lib/weather/met-no';
import { compassAngle } from '../lib/map/compass';
import type { Forecast } from '../lib/weather/types';

function fixture(temperature = 21): Forecast {
  const hourly = Object.fromEntries(
    [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation_probability',
      'weather_code',
      'wind_speed_10m',
      'is_day',
    ].map((k) => [
      k,
      Array.from({ length: 168 }, () =>
        k === 'temperature_2m' || k === 'apparent_temperature'
          ? temperature
          : k === 'relative_humidity_2m'
            ? 50
            : 0,
      ),
    ]),
  );
  const daily = Object.fromEntries(
    [
      'temperature_2m_max',
      'temperature_2m_min',
      'weather_code',
      'precipitation_probability_max',
      'sunrise',
      'sunset',
      'uv_index_max',
    ].map((k) => [k, Array.from({ length: 7 }, () => 0)]),
  );
  return {
    current: {
      time: 1788641100,
      temperature_2m: temperature,
      apparent_temperature: temperature,
      relative_humidity_2m: 50,
      precipitation: 0,
      weather_code: 0,
      wind_speed_10m: 10,
      wind_direction_10m: 180,
      is_day: 1,
    },
    hourly: {
      ...hourly,
      time: Array.from({ length: 168 }, (_, i) => 1788641100 + i * 3600),
    },
    daily: {
      ...daily,
      time: Array.from({ length: 7 }, (_, i) => 1788641100 + i * 86400),
    },
  } as Forecast;
}
const payload = () => DISTRICTS.map((_, i) => fixture(i));
const marinePayload = () =>
  COASTAL_POINTS.map((_, i) => ({
    current: { sea_surface_temperature: (15 + i) as number | null },
  }));
const isMarine = (url: unknown) => String(url).includes('marine');

void test('all 18 districts and both autonomous regions have matching real geometry', () => {
  const geometry = JSON.parse(
    readFileSync(
      new URL('../public/portugal-districts.geojson', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(DISTRICTS.filter((d) => d.region === 'continent').length, 18);
  assert.equal(new Set(DISTRICTS.map((d) => d.id)).size, 20);
  assert.deepEqual(
    new Set(
      geometry.features.map(
        (f: { properties: { shapeISO: string } }) => f.properties.shapeISO,
      ),
    ),
    new Set(DISTRICTS.map((d) => d.id)),
  );
});
void test('one upstream request serves concurrent visitors and remains cached for exactly one hour', async () => {
  let calls = 0,
    time = 1788641100000;
  const get = createWeatherService(
    async (url) => {
      if (isMarine(url)) return Response.json(marinePayload());
      calls++;
      await Promise.resolve();
      return Response.json(payload());
    },
    () => time,
  );
  const [first, second] = await Promise.all([get(), get()]);
  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(first.districts['PT-11'].current.temperature_2m, 10);
  assert.equal(first.sea?.['sea-viana'], 15);
  assert.equal(first.sea?.['sea-faro'], 22);
  time += HOUR_MS - 1;
  assert.equal(await get(), first);
  assert.equal(calls, 1);
  time++;
  const refreshed = await get();
  assert.equal(calls, 2);
  assert.equal(refreshed.fetchedAt, time);
  assert.equal(refreshed.expiresAt - refreshed.fetchedAt, HOUR_MS);
});
void test('provider failure does not cache an error; backoff blocks hammering and recovery happens after the cooldown', async () => {
  let calls = 0,
    time = 1788641100000;
  const get = createWeatherService(
    async (url) => {
      if (isMarine(url)) return Response.json(marinePayload());
      calls++;
      return calls <= 2
        ? new Response('provider error', { status: 503 })
        : Response.json(payload());
    },
    () => time,
  );
  await assert.rejects(get(), /503/);
  assert.equal(calls, 1);
  // Within the cooldown the service fails fast without touching the upstream.
  await assert.rejects(get(), /temporarily unavailable/);
  time += FAILURE_COOLDOWN_MS - 1;
  await assert.rejects(get(), /temporarily unavailable/);
  assert.equal(calls, 1);
  // After the cooldown one retry is allowed; it fails and backs off further.
  time++;
  await assert.rejects(get(), /503/);
  assert.equal(calls, 2);
  time += FAILURE_COOLDOWN_MS;
  await assert.rejects(get(), /temporarily unavailable/);
  assert.equal(calls, 2);
  time += FAILURE_COOLDOWN_MS;
  assert.equal(Object.keys((await get()).districts).length, 20);
  assert.equal(calls, 3);
});
void test('an expired cache keeps being served while the upstream is failing', async () => {
  let calls = 0,
    time = 1788641100000;
  const get = createWeatherService(
    async (url) => {
      if (isMarine(url)) return Response.json(marinePayload());
      calls++;
      return calls === 1
        ? Response.json(payload())
        : new Response('provider error', { status: 503 });
    },
    () => time,
  );
  const fresh = await get();
  time += HOUR_MS;
  const stale = await get();
  assert.equal(calls, 2);
  assert.equal(stale, fresh);
  // Subsequent visitors get the stale snapshot without new upstream calls.
  assert.equal(await get(), fresh);
  time += FAILURE_COOLDOWN_MS - 1;
  assert.equal(await get(), fresh);
  assert.equal(calls, 2);
});
void test('invalid and partial provider results are rejected', async () => {
  assert.equal(validateForecast(null), false);
  assert.equal(validateForecast(fixture()), true);
  const broken = fixture();
  broken.hourly.time = [0];
  assert.equal(validateForecast(broken), false);
  const get = createWeatherService(async () => Response.json([fixture()]));
  await assert.rejects(get(), /Invalid weather/);
});
void test('requests use all coordinates in the same order, seven days and unambiguous epoch times', () => {
  const p = new URL(forecastUrl()).searchParams;
  assert.equal(p.get('latitude')?.split(',').length, 20);
  assert.equal(p.get('timeformat'), 'unixtime');
  assert.equal(p.get('forecast_days'), '7');
});
void test('Lisbon and Azores hours are correct through summer and winter daylight saving', () => {
  assert.equal(
    hour(Date.parse('2026-07-01T12:00:00Z') / 1000, 'Europe/Lisbon'),
    '13:00',
  );
  assert.equal(
    hour(Date.parse('2026-07-01T12:00:00Z') / 1000, 'Atlantic/Azores'),
    '12:00',
  );
  assert.equal(
    hour(Date.parse('2026-01-01T12:00:00Z') / 1000, 'Atlantic/Azores'),
    '11:00',
  );
});
void test('weather classifications, missing values and hour boundaries are safe', () => {
  assert.equal(condition(0).label, 'Céu limpo');
  assert.equal(condition(95).kind, 'storm');
  assert.equal(condition(85).kind, 'snow');
  assert.equal(condition(null).kind, 'unknown');
  assert.equal(value(null), '—');
  assert.equal(value(Number.NaN), '—');
  assert.equal(value(0, '%'), '0%');
  assert.equal(hourIndex([0, 3600, 7200], 7199999), 1);
});
void test('map legend colors clamp outliers and distinguish missing observations from zero', () => {
  assert.equal(metricColor('rain', 100), '#4c9cc4');
  assert.equal(metricColor('rain', 200), metricColor('rain', 100));
  assert.equal(
    metricColor('temperature', -100),
    metricColor('temperature', -5),
  );
  assert.notEqual(metricColor('rain', null), metricColor('rain', 0));
  assert.equal(metricColor('sea', 26), '#7ecdc1');
  assert.equal(metricColor('sea', 100), metricColor('sea', 26));
  assert.equal(metricColor('sea', 0), metricColor('sea', 12));
  assert.notEqual(metricColor('sea', null), metricColor('sea', 12));
});
void test('marine request uses every coastal coordinate in order and asks for the current sea surface temperature', () => {
  const p = new URL(marineUrl()).searchParams;
  assert.equal(p.get('latitude')?.split(',').length, COASTAL_POINTS.length);
  assert.equal(p.get('longitude')?.split(',').length, COASTAL_POINTS.length);
  assert.equal(p.get('current'), 'sea_surface_temperature');
  assert.equal(p.get('timeformat'), 'unixtime');
});
void test('marine payloads are validated point by point and allow missing observations', () => {
  const sea = seaFromPayload(marinePayload());
  assert.equal(Object.keys(sea).length, COASTAL_POINTS.length);
  assert.equal(sea['sea-viana'], 15);
  const withGap = marinePayload();
  withGap[0].current.sea_surface_temperature = null;
  assert.equal(seaFromPayload(withGap)['sea-viana'], null);
  assert.throws(() => seaFromPayload(marinePayload().slice(1)), /Invalid marine/);
  const broken = marinePayload();
  (broken[0].current as { sea_surface_temperature: unknown })
    .sea_surface_temperature = 'warm';
  assert.throws(() => seaFromPayload(broken), /Invalid marine/);
});
void test('a failing marine provider never breaks the forecast response', async () => {
  const time = 1788641100000;
  const get = createWeatherService(
    async (url) =>
      isMarine(url)
        ? new Response('marine down', { status: 503 })
        : Response.json(payload()),
    () => time,
  );
  const data = await get();
  assert.equal(data.sea, undefined);
  assert.equal(data.districts['PT-11'].current.temperature_2m, 10);
});
void test('compass rotation follows north on screen in every cardinal direction', () => {
  assert.equal(compassAngle(0, 0, 0, 1), 0);
  assert.equal(compassAngle(0, 0, 1, 0), 90);
  assert.equal(compassAngle(0, 0, 0, -1), 180);
  assert.equal(compassAngle(0, 0, -1, 0), -90);
});
void test('MET Norway symbols and solar fallback preserve the shared forecast contract', () => {
  assert.equal(metNoSymbolToWmo('clearsky_day'), 0);
  assert.equal(metNoSymbolToWmo('heavyrainshowersandthunder_night'), 95);
  assert.equal(metNoSymbolToWmo('snowshowers_day'), 85);
  const [sunrise, sunset] = solarTimes('2026-09-06', 38.7223, -9.1393);
  assert.ok(Number.isFinite(sunrise));
  assert.ok(sunset > sunrise);
  assert.ok(sunset - sunrise > 11 * 3600);
  assert.ok(sunset - sunrise < 14 * 3600);
});
void test('clothing advice uses the remaining hourly evolution, rain, wind and humidity', () => {
  const cold = fixture(5);
  cold.daily.uv_index_max = Array(7).fill(1);
  assert.equal(recommendClothing(cold, 'Europe/Lisbon').title, 'Casaco quente');

  const changing = fixture(25);
  changing.hourly.apparent_temperature.fill(25);
  changing.hourly.apparent_temperature[0] = 12;
  changing.hourly.precipitation_probability.fill(80);
  changing.hourly.relative_humidity_2m.fill(90);
  changing.hourly.wind_speed_10m.fill(36);
  changing.daily.uv_index_max = Array(7).fill(8);
  const advice = recommendClothing(changing, 'Europe/Lisbon');
  assert.equal(advice.title, 'Casaco quente');
  assert.ok(advice.details.some((item) => item.kind === 'layers'));
  assert.ok(advice.details.some((item) => item.kind === 'rain'));
  assert.ok(advice.details.some((item) => item.kind === 'wind'));
});
