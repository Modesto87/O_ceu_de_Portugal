'use client';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { Clock3, CalendarDays, Droplets } from 'lucide-react';
import type { Forecast } from '@/lib/weather/types';
import type { District } from '@/lib/weather/districts';
import { hour, hourIndex, value, condition } from '@/lib/weather/format';
import WeatherIcon from './WeatherIcon';

export default function ForecastDetails({
  forecast,
  district,
}: {
  forecast: Forecast;
  district: District;
}) {
  const start = hourIndex(forecast.hourly.time);
  const data = forecast.hourly.time.slice(start, start + 24).map((time, j) => ({
    time: hour(time, district.timezone),
    temperature: forecast.hourly.temperature_2m[start + j],
    rain: forecast.hourly.precipitation_probability[start + j],
    code: forecast.hourly.weather_code[start + j],
    day: forecast.hourly.is_day[start + j],
  }));
  return (
    <div className="forecast-grid">
      <section
        className="forecast-section hourly-section"
        aria-label="Previsão das próximas 24 horas"
      >
        <div className="section-title">
          <h3>
            <Clock3 size={17} /> Nas próximas horas
          </h3>
          <span>{district.name} · hora local</span>
        </div>
        <div className="hourly-scroll">
          {data
            .filter((_, i) => i % 3 === 0)
            .map((h, i) => (
              <div className="hourly-cell" key={`${h.time}-${i}`}>
                <span>{h.time}</span>
                <WeatherIcon code={h.code} day={h.day} size={23} />
                <strong>{value(h.temperature, '°')}</strong>
                <small>
                  <Droplets size={10} />
                  {value(h.rain, '%')}
                </small>
              </div>
            ))}
        </div>
        <ChartContainer
          className="temperature-chart"
          config={{ temperature: { label: 'Temperatura', color: '#dec792' } }}
          aria-label="Evolução da temperatura em graus Celsius"
        >
          <AreaChart
            data={data}
            margin={{ left: -25, right: 10, top: 15, bottom: 0 }}
          >
            <defs>
              <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#dec792" stopOpacity={0.2} />
                <stop offset="1" stopColor="#dec792" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#263b45"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              minTickGap={60}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              domain={['dataMin - 2', 'dataMax + 2']}
              tickFormatter={(v) => `${Math.round(v)}°`}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                background: '#142a35',
                border: '1px solid #415861',
                borderRadius: 8,
                color: '#e9edde',
              }}
              formatter={(v) => [`${String(v)} °C`, 'Temperatura']}
            />
            <Area
              type="monotone"
              dataKey="temperature"
              stroke="#dec792"
              strokeWidth={2}
              fill="url(#tempFill)"
              isAnimationActive={false}
              connectNulls={false}
            />
          </AreaChart>
        </ChartContainer>
      </section>
      <section
        className="forecast-section daily-section"
        aria-label="Previsão para sete dias"
      >
        <div className="section-title">
          <h3>
            <CalendarDays size={17} /> Os próximos 7 dias
          </h3>
          <span>Mín. / Máx.</span>
        </div>
        <div className="daily-list">
          {forecast.daily.time.map((time, i) => {
            const min = forecast.daily.temperature_2m_min[i],
              max = forecast.daily.temperature_2m_max[i];
            const allMin = Math.min(
                ...forecast.daily.temperature_2m_min.filter(
                  (n): n is number => n != null,
                ),
              ),
              allMax = Math.max(
                ...forecast.daily.temperature_2m_max.filter(
                  (n): n is number => n != null,
                ),
              );
            return (
              <div className="daily-row" key={time}>
                <span>
                  {i === 0
                    ? 'Hoje'
                    : new Intl.DateTimeFormat('pt-PT', {
                        weekday: 'short',
                        timeZone: district.timezone,
                      }).format(time * 1000)}
                </span>
                <span title={condition(forecast.daily.weather_code[i]).label}>
                  <WeatherIcon
                    code={forecast.daily.weather_code[i]}
                    size={22}
                  />
                </span>
                <small>
                  {value(forecast.daily.precipitation_probability_max[i], '%')}
                </small>
                <span className="daily-min">{value(min, '°')}</span>
                <div className="range-track" aria-hidden="true">
                  {min != null && max != null && (
                    <i
                      style={{
                        left: `${((min - allMin) / Math.max(1, allMax - allMin)) * 100}%`,
                        width: `${Math.max(3, ((max - min) / Math.max(1, allMax - allMin)) * 100)}%`,
                      }}
                    />
                  )}
                </div>
                <strong>{value(max, '°')}</strong>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
