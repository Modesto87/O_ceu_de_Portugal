'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { flushSync } from 'react-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CloudSun,
  MapPin,
  Wind,
  Droplets,
  Thermometer,
  Layers,
  Clock3,
  Play,
  Pause,
  RefreshCw,
  AlertCircle,
  Waves,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { DISTRICTS, REGION_NAMES, type Region } from '@/lib/weather/districts';
import { seaPointForDistrict } from '@/lib/weather/coast';
import { hour, hourIndex, value } from '@/lib/weather/format';
import type { Layer } from '@/lib/weather/types';
import { useWeather } from '@/hooks/use-weather';
import PortugalMap from '@/components/map/PortugalMap';
import WeatherPanel from './WeatherPanel';
import ForecastDetails from './ForecastDetails';
import ClothingAdvice from './ClothingAdvice';

export default function WeatherDashboard() {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <Dashboard />
    </QueryClientProvider>
  );
}
function Dashboard() {
  const [selected, setSelected] = useState('PT-11');
  const [region, setRegion] = useState<Region>('continent');
  const [layer, setLayer] = useState<Layer>('temperature');
  const [offset, setOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(Date.now);
  const weather = useWeather();
  const district = DISTRICTS.find((d) => d.id === selected)!;
  const forecast = weather.data?.districts[selected];
  const stale = !!weather.data && now >= weather.data.expiresAt;
  const selectDistrict = useCallback((id: string) => {
    const d = DISTRICTS.find((x) => x.id === id);
    if (d) {
      setSelected(id);
      setRegion(d.region);
    }
  }, []);
  function selectRegion(next: Region) {
    setRegion(next);
    setSelected(
      next === 'continent'
        ? 'PT-11'
        : DISTRICTS.find((d) => d.region === next)!.id,
    );
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setOffset((n) => (n + 1) % 24), 1600);
    return () => clearInterval(timer);
  }, [playing]);
  const currentState = useRef({ selected, layer, data: weather.data });
  useLayoutEffect(() => {
    currentState.current = { selected, layer, data: weather.data };
  }, [selected, layer, weather.data]);
  useEffect(() => {
    type Tool = {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    };
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools: Tool[] = [
      {
        name: 'show_district_weather',
        description:
          'Seleciona um distrito ou região e mostra a previsão no mapa e no painel.',
        inputSchema: {
          type: 'object',
          properties: {
            districtId: { type: 'string', enum: DISTRICTS.map((d) => d.id) },
          },
          required: ['districtId'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const id = (input as { districtId?: string })?.districtId;
          if (!DISTRICTS.some((d) => d.id === id))
            throw Error('Distrito inválido');
          flushSync(() => selectDistrict(id!));
          return { selected: currentState.current.selected };
        },
      },
      {
        name: 'get_selected_weather',
        description:
          'Lê o distrito selecionado e as condições meteorológicas disponíveis, incluindo a hora de atualização.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute() {
          const s = currentState.current;
          return {
            district: s.selected,
            fetchedAt: s.data?.fetchedAt ?? null,
            current: s.data?.districts[s.selected]?.current ?? null,
          };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Optional browser capability. */
      }
    }
    return () => lifecycle.abort();
  }, [selectDistrict]);
  const mapTime =
    forecast?.hourly.time[hourIndex(forecast.hourly.time) + offset];
  const status = weather.isPending
    ? 'A obter a meteorologia'
    : weather.isError || stale
      ? 'A aguardar atualização'
      : `Atualizado às ${hour((weather.data?.fetchedAt ?? now) / 1000)}`;
  const legend =
    layer === 'temperature'
      ? ['−5 °C', '40 °C']
      : layer === 'rain'
        ? ['0%', '100%']
        : layer === 'sea'
          ? ['12 °C', '26 °C']
          : ['0 km/h', '70+ km/h'];
  function mapValue(id: string) {
    if (layer === 'sea') {
      const point = seaPointForDistrict(id);
      return point ? value(weather.data?.sea?.[point.id], '°') : '—';
    }
    const f = weather.data?.districts[id];
    if (!f) return '—';
    const ix = hourIndex(f.hourly.time) + offset;
    return layer === 'rain'
      ? value(f.hourly.precipitation_probability[ix], '%')
      : layer === 'wind'
        ? value(f.hourly.wind_speed_10m[ix])
        : value(
            offset ? f.hourly.temperature_2m[ix] : f.current.temperature_2m,
            '°',
          );
  }
  return (
    <div className="site-shell">
      <a href="#main" className="skip-link">
        Saltar para a meteorologia
      </a>
      <header className="site-header">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <CloudSun size={27} />
          </span>
          <span>
            O Céu de <b>Portugal</b>
            <small>UM PAÍS. TODOS OS CÉUS.</small>
          </span>
        </Link>
        <div className="header-right">
          <span className="live-status">
            <span
              className={weather.data && !stale ? 'live-dot' : 'inactive-dot'}
            />
            {status}
          </span>
          <span className="country-badge">
            PT <span>38° N · 9° W</span>
          </span>
        </div>
      </header>
      <main id="main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">O TEMPO, COM OUTRA PERSPETIVA</p>
            <h1>
              Portugal, sob o mesmo céu<span>.</span>
            </h1>
          </div>
          <p className="heading-note">
            <Clock3 size={15} /> Atualização de hora a hora
          </p>
        </div>
        {(weather.isError || stale) && (
          <output className="weather-error">
            <AlertCircle size={18} />
            <span>
              {weather.data
                ? 'A atualização está atrasada. A mostrar a última previsão recebida.'
                : 'Não foi possível obter a meteorologia. O mapa continua disponível.'}
            </span>
            <button
              disabled={weather.isFetching}
              onClick={() => weather.refetch()}
            >
              <RefreshCw size={14} />
              {weather.isFetching ? 'A tentar…' : 'Tentar novamente'}
            </button>
          </output>
        )}
        <div className="weather-workspace">
          <section
            className="explorer"
            aria-label="Explorar meteorologia de Portugal"
          >
            <div className="explorer-top">
              <Tabs
                value={region}
                onValueChange={(v) => selectRegion(v as Region)}
              >
                <TabsList
                  className="region-tabs"
                  aria-label="Região de Portugal"
                >
                  {Object.entries(REGION_NAMES).map(([id, label]) => (
                    <TabsTrigger key={id} value={id}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <span className="map-badge">
                <Layers size={14} /> MAPA 3D
              </span>
            </div>
            <div className="map-area">
              <aside className="district-list">
                <p className="eyebrow">
                  {region === 'continent' ? '18 DISTRITOS' : 'REGIÃO AUTÓNOMA'}
                </p>
                {DISTRICTS.filter((d) => d.region === region).map((d) => (
                  <button
                    key={d.id}
                    className={d.id === selected ? 'active' : ''}
                    onClick={() => selectDistrict(d.id)}
                    aria-pressed={d.id === selected}
                  >
                    <span>{d.name}</span>
                    <span>{mapValue(d.id)}</span>
                  </button>
                ))}
              </aside>
              <div className="map-surface">
                <div className="layer-picker">
                  <Tabs
                    value={layer}
                    onValueChange={(v) => setLayer(v as Layer)}
                  >
                    <TabsList aria-label="Informação no mapa">
                      {(
                        [
                          ['temperature', 'Temperatura', Thermometer],
                          ['rain', 'Chuva', Droplets],
                          ['wind', 'Vento', Wind],
                          ['sea', 'Mar', Waves],
                        ] as const
                      ).map(([id, title, Icon]) => (
                        <TabsTrigger key={id} value={id}>
                          <Icon size={14} />
                          {title}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
                <PortugalMap
                  key={region}
                  region={region}
                  selected={selected}
                  onSelect={selectDistrict}
                  weather={weather.data}
                  layer={layer}
                  offset={offset}
                />
                <div className={`map-legend legend-${layer}`}>
                  <span>{legend[0]}</span>
                  <i />
                  <span>{legend[1]}</span>
                  <span className="selection-key">● Selecionado</span>
                </div>
              </div>
            </div>
            <div className="mobile-picker">
              <MapPin size={17} />
              <Select
                value={selected}
                onValueChange={(v) => v && selectDistrict(v)}
              >
                <SelectTrigger aria-label="Escolher distrito">
                  <SelectValue>{district.name}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DISTRICTS.filter((d) => d.region === region).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="timeline">
              <button
                className="play-button"
                aria-label={
                  playing
                    ? 'Pausar evolução do tempo'
                    : 'Animar próximas 24 horas'
                }
                aria-pressed={playing}
                onClick={() => setPlaying(!playing)}
                disabled={!forecast}
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <div className="timeline-label">
                <span>NO MAPA</span>
                <strong>
                  {offset === 0
                    ? 'Agora'
                    : mapTime
                      ? hour(mapTime, district.timezone)
                      : '—'}
                  {offset > 0 && <small> +{offset} h</small>}
                </strong>
              </div>
              <div className="timeline-slider">
                <Slider
                  min={0}
                  max={23}
                  step={1}
                  value={[offset]}
                  disabled={!forecast}
                  onValueChange={(v) => {
                    setOffset(Array.isArray(v) ? v[0] : v);
                    setPlaying(false);
                  }}
                  aria-label="Hora da previsão no mapa"
                />
                <div className="timeline-ticks">
                  <span>Agora</span>
                  <span>+6 h</span>
                  <span>+12 h</span>
                  <span>+18 h</span>
                  <span>+23 h</span>
                </div>
              </div>
              <button
                className="now-button"
                onClick={() => {
                  setOffset(0);
                  setPlaying(false);
                }}
                disabled={offset === 0}
              >
                Agora
              </button>
            </div>
          </section>
          <WeatherPanel
            district={district}
            forecast={forecast}
            sea={weather.data?.sea}
            loading={weather.isPending}
          />
        </div>
        {forecast && <ClothingAdvice forecast={forecast} district={district} />}
        {forecast && (
          <ForecastDetails forecast={forecast} district={district} />
        )}
        <div className="data-note">
          <Clock3 size={14} />
          <span>
            {weather.data
              ? `Recebido às ${hour(weather.data.fetchedAt / 1000)} · Próxima atualização ${hour(weather.data.expiresAt / 1000)} (hora de Lisboa).`
              : 'As previsões são atualizadas uma vez por hora.'}{' '}
            A chuva no mapa indica probabilidade, não radar.
          </span>
        </div>
      </main>
      <footer>
        <span>
          O Céu de Portugal <span className="footer-dot">·</span> Feito para
          olhar lá para fora.
        </span>
        <div className="source-links">
          {weather.data?.source === 'met-no' ? (
            <a href="https://api.met.no/" target="_blank" rel="noreferrer">
              Dados: MET Norway · CC BY 4.0 <ArrowUpRight size={12} />
            </a>
          ) : (
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo · CC BY 4.0 <ArrowUpRight size={12} />
            </a>
          )}
          <a
            href="https://www.geoboundaries.org/api/current/gbOpen/PRT/ADM1/"
            target="_blank"
            rel="noreferrer"
          >
            Mapa: DGT / geoBoundaries · ODbL <ArrowUpRight size={12} />
          </a>
        </div>
      </footer>
    </div>
  );
}
