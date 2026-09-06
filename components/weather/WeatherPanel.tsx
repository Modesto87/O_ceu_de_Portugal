'use client';
import {
  ArrowUpRight,
  MapPin,
  Wind,
  Droplets,
  Thermometer,
  Sun,
  Sunrise,
  Sunset,
} from 'lucide-react';
import type { District } from '@/lib/weather/districts';
import { REGION_NAMES } from '@/lib/weather/districts';
import type { Forecast } from '@/lib/weather/types';
import { condition, hour, value } from '@/lib/weather/format';
import WeatherIcon from './WeatherIcon';

export default function WeatherPanel({
  district,
  forecast,
  loading,
}: {
  district: District;
  forecast?: Forecast;
  loading: boolean;
}) {
  const c = forecast?.current,
    d = forecast?.daily;
  const uv = d?.uv_index_max[0];
  return (
    <aside
      className="weather-panel"
      aria-label={`Condições atuais em ${district.name}`}
    >
      <div className="panel-top">
        <span className="eyebrow">
          {district.region === 'continent' ? 'O SEU DISTRITO' : 'A SUA REGIÃO'}
        </span>
        <ArrowUpRight size={18} />
      </div>
      <div key={district.id} className="panel-reveal">
        <h2>{district.name}</h2>
        <p className="location-sub">
          <MapPin size={13} /> {REGION_NAMES[district.region]}, Portugal
        </p>
        <div className="temperature-block">
          <span className="big-temperature">
            {value(c?.temperature_2m)}
            <sup>°</sup>
          </span>
          <div className="condition-orbit">
            <WeatherIcon code={c?.weather_code} day={c?.is_day} size={78} />
          </div>
        </div>
        <p className="condition-title">
          {loading ? 'A obter a previsão…' : condition(c?.weather_code).label}
        </p>
        <p className="muted">
          Máx. <b>{value(d?.temperature_2m_max[0], '°')}</b>{' '}
          <span className="divider-dot">·</span> Mín.{' '}
          <b>{value(d?.temperature_2m_min[0], '°')}</b>
        </p>
        <div className="metric-grid">
          <div>
            <Wind size={19} />
            <span>Vento</span>
            <strong>
              {value(c?.wind_speed_10m)} <small>km/h</small>
            </strong>
          </div>
          <div>
            <Droplets size={19} />
            <span>Humidade</span>
            <strong>
              {value(c?.relative_humidity_2m)} <small>%</small>
            </strong>
          </div>
          <div>
            <Thermometer size={19} />
            <span>Sensação</span>
            <strong>
              {value(c?.apparent_temperature)} <small>°C</small>
            </strong>
          </div>
          <div>
            <Sun size={19} />
            <span>UV máximo hoje</span>
            <strong>
              {value(uv)}{' '}
              <small>
                {uv == null
                  ? ''
                  : uv < 3
                    ? 'Baixo'
                    : uv < 6
                      ? 'Moderado'
                      : uv < 8
                        ? 'Elevado'
                        : uv < 11
                          ? 'Muito elevado'
                          : 'Extremo'}
              </small>
            </strong>
          </div>
        </div>
        <div className="sun-times">
          <div>
            <Sunrise size={18} />
            <span>
              Nascer do sol
              <strong>
                {d?.sunrise[0] ? hour(d.sunrise[0], district.timezone) : '—'}
              </strong>
            </span>
          </div>
          <div>
            <Sunset size={18} />
            <span>
              Pôr do sol
              <strong>
                {d?.sunset[0] ? hour(d.sunset[0], district.timezone) : '—'}
              </strong>
            </span>
          </div>
        </div>
        <p className="reference-note">
          {district.region === 'continent'
            ? `Referência: capital do distrito de ${district.name}. O tempo pode variar dentro do distrito.`
            : district.region === 'madeira'
              ? 'Referência: Funchal. O tempo pode variar nas outras zonas e ilhas.'
              : 'Referência: Ponta Delgada, São Miguel. O tempo pode variar nas outras ilhas.'}
        </p>
        <div className="panel-foot">
          <span className={c ? 'live-dot' : 'inactive-dot'} />
          {c
            ? `Condições às ${hour(c.time, district.timezone)} · hora local`
            : 'A aguardar dados meteorológicos'}
        </div>
      </div>
    </aside>
  );
}
