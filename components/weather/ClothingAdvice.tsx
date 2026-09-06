import { Shirt, Umbrella, Wind, Sun, Sparkles, Droplets } from 'lucide-react';
import type { Forecast } from '@/lib/weather/types';
import type { District } from '@/lib/weather/districts';
import { recommendClothing } from '@/lib/weather/clothing';

export default function ClothingAdvice({
  forecast,
  district,
}: {
  forecast: Forecast;
  district: District;
}) {
  const advice = recommendClothing(forecast, district.timezone);
  const icons = {
    layers: Shirt,
    rain: Umbrella,
    wind: Wind,
    humidity: Droplets,
    sun: Sun,
  };
  return (
    <section
      className={`clothing-advice clothing-${advice.level}`}
      aria-label="Sugestão de roupa para hoje"
    >
      <div className="clothing-heading">
        <span className="clothing-icon">
          <Shirt size={23} />
        </span>
        <div>
          <span className="eyebrow">
            <Sparkles size={12} /> PARA VESTIR HOJE
          </span>
          <h3>{advice.title}</h3>
        </div>
        <span className="clothing-range">{advice.range}</span>
      </div>
      <p>{advice.summary}</p>
      <ul>
        {advice.details.map((detail) => {
          const Icon = icons[detail.kind];
          return (
            <li key={detail.text}>
              <Icon size={15} />
              <span>{detail.text}</span>
            </li>
          );
        })}
      </ul>
      <small>
        Conselho indicativo com base na sensação térmica, humidade, vento, chuva
        e evolução horária. Adapte à sua sensibilidade e atividade.
      </small>
    </section>
  );
}
