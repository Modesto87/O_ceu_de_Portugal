import type { Forecast } from './types';

export type ClothingAdvice = {
  level: 'light' | 'layers' | 'jacket' | 'warm' | 'protected';
  title: string;
  summary: string;
  details: {
    kind: 'layers' | 'rain' | 'wind' | 'humidity' | 'sun';
    text: string;
  }[];
  range: string;
};

const finite = (values: (number | null | undefined)[]) =>
  values.filter(
    (n): n is number => typeof n === 'number' && Number.isFinite(n),
  );

function dateKey(timestamp: number, timezone: string) {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).format(timestamp * 1000);
}

export function recommendClothing(
  forecast: Forecast,
  timezone: string,
  now = forecast.current.time,
): ClothingAdvice {
  // Um separador aberto durante uma atualização pode reter temporariamente
  // uma resposta antiga no React Query. Usamos séries compatíveis até renovar.
  const apparentTemperatures =
    forecast.hourly.apparent_temperature ?? forecast.hourly.temperature_2m;
  const relativeHumidity = forecast.hourly.relative_humidity_2m ?? [];
  const today = dateKey(now, timezone);
  let indexes = forecast.hourly.time
    .map((time, index) => ({ time, index }))
    .filter(
      ({ time }) => time >= now - 1800 && dateKey(time, timezone) === today,
    )
    .map(({ index }) => index);

  // Perto da meia-noite, mantém a sugestão útil para uma saída curta.
  if (indexes.length < 3) {
    const found = forecast.hourly.time.findIndex((time) => time >= now);
    const start =
      found < 0 ? Math.max(0, forecast.hourly.time.length - 1) : found;
    indexes = Array.from(
      { length: Math.min(6, forecast.hourly.time.length - start) },
      (_, index) => start + index,
    );
  }

  const feels = finite(indexes.map((i) => apparentTemperatures[i]));
  const temperatures = finite(
    indexes.map((i) => forecast.hourly.temperature_2m[i]),
  );
  const winds = finite(indexes.map((i) => forecast.hourly.wind_speed_10m[i]));
  const humidity = finite(indexes.map((i) => relativeHumidity[i]));
  const rain = finite(
    indexes.map((i) => forecast.hourly.precipitation_probability[i]),
  );
  const fallback =
    forecast.current.apparent_temperature ??
    forecast.current.temperature_2m ??
    18;
  const minimum = Math.min(...(feels.length ? feels : [fallback]));
  const maximum = Math.max(
    ...(feels.length ? feels : temperatures.length ? temperatures : [fallback]),
  );
  const maxWind = Math.max(
    ...(winds.length ? winds : [forecast.current.wind_speed_10m ?? 0]),
  );
  const maxRain = Math.max(...(rain.length ? rain : [0]));
  const averageHumidity = humidity.length
    ? humidity.reduce((sum, item) => sum + item, 0) / humidity.length
    : (forecast.current.relative_humidity_2m ?? 0);

  const levels = [
    {
      level: 'light',
      title: 'Roupa ligeira',
      summary: 'O dia permite roupa fresca e respirável.',
    },
    {
      level: 'layers',
      title: 'Camadas leves',
      summary: 'Uma camada fina dá margem para as mudanças do dia.',
    },
    {
      level: 'jacket',
      title: 'Casaco leve',
      summary: 'Leve um casaco leve para as horas mais frescas.',
    },
    {
      level: 'warm',
      title: 'Casaco quente',
      summary: 'Vista camadas quentes e um casaco confortável.',
    },
    {
      level: 'protected',
      title: 'Bem protegido',
      summary: 'Use roupa quente, casaco fechado e calçado coberto.',
    },
  ] as const;
  let index =
    minimum <= 3
      ? 4
      : minimum <= 9
        ? 3
        : minimum <= 15
          ? 2
          : minimum <= 20
            ? 1
            : 0;
  if (maxWind >= 35 && minimum <= 18) index = Math.min(4, index + 1);
  const selected = levels[index];
  const details: ClothingAdvice['details'] = [];
  if (maximum - minimum >= 7)
    details.push({
      kind: 'layers',
      text: `Camadas removíveis: a sensação varia cerca de ${Math.round(maximum - minimum)}° hoje.`,
    });
  if (maxRain >= 55)
    details.push({
      kind: 'rain',
      text: `Impermeável ou guarda-chuva: até ${Math.round(maxRain)}% de chuva.`,
    });
  else if (maxRain >= 30)
    details.push({
      kind: 'rain',
      text: `Leve proteção leve: a chuva pode chegar a ${Math.round(maxRain)}%.`,
    });
  if (maxWind >= 30)
    details.push({
      kind: 'wind',
      text: 'Prefira uma camada corta-vento nas horas mais ventosas.',
    });
  if (averageHumidity >= 80 && maximum >= 23)
    details.push({
      kind: 'humidity',
      text: 'Tecidos respiráveis ajudam com a humidade elevada.',
    });
  const uv = forecast.daily.uv_index_max[0];
  if (uv != null && uv >= 6)
    details.push({
      kind: 'sun',
      text: 'Nas horas de sol, use protetor solar, óculos e chapéu.',
    });
  if (!details.length)
    details.push({
      kind: 'layers',
      text: 'Não são esperadas mudanças que exijam proteção adicional.',
    });

  return {
    level: selected.level,
    title: selected.title,
    summary: selected.summary,
    details: details.slice(0, 3),
    range: `Sensação prevista: ${Math.round(minimum)}° a ${Math.round(maximum)}°`,
  };
}
