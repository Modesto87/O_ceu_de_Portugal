import type { Layer } from './types';
const scales: Record<
  Layer,
  { min: number; max: number; from: number[]; to: number[] }
> = {
  temperature: { min: -5, max: 40, from: [55, 117, 148], to: [202, 179, 116] },
  rain: { min: 0, max: 100, from: [36, 73, 87], to: [76, 156, 196] },
  wind: { min: 0, max: 70, from: [53, 68, 100], to: [178, 164, 212] },
};
export function metricColor(layer: Layer, metric: number | null | undefined) {
  if (metric == null || !Number.isFinite(metric)) return '#36515b';
  const s = scales[layer];
  const t = Math.max(0, Math.min(1, (metric - s.min) / (s.max - s.min)));
  return `#${s.from
    .map((n, i) =>
      Math.round(n + (s.to[i] - n) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
