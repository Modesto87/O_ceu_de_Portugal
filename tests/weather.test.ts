import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DISTRICTS } from '../lib/weather/districts';
import {
  createWeatherService,
  HOUR_MS,
  validateForecast,
  forecastUrl,
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
    async () => {
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
  time += HOUR_MS - 1;
  assert.equal(await get(), first);
  assert.equal(calls, 1);
  time++;
  const refreshed = await get();
  assert.equal(calls, 2);
  assert.equal(refreshed.fetchedAt, time);
  assert.equal(refreshed.expiresAt - refreshed.fetchedAt, HOUR_MS);
});
void test('provider failure does not cache an error or fabricate fresh data; the next request recovers', async () => {
  let calls = 0;
  const get = createWeatherService(async () => {
    calls++;
    return calls === 1
      ? new Response('provider error', { status: 503 })
      : Response.json(payload());
  });
  await assert.rejects(get(), /503/);
  assert.equal(Object.keys((await get()).districts).length, 20);
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
