export const value = (n: number | null | undefined, suffix = '') =>
  typeof n === 'number' && Number.isFinite(n)
    ? `${Math.round(n)}${suffix}`
    : '—';
export const hour = (time: number, timezone = 'Europe/Lisbon') =>
  new Intl.DateTimeFormat('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(time * 1000);
export function condition(code: number | null | undefined) {
  if (code == null) return { label: 'Sem informação', kind: 'unknown' };
  if (code === 0) return { label: 'Céu limpo', kind: 'sun' };
  if (code <= 2) return { label: 'Pouco nublado', kind: 'partly' };
  if (code === 3) return { label: 'Céu nublado', kind: 'cloud' };
  if (code <= 48) return { label: 'Nevoeiro', kind: 'fog' };
  if (code >= 95) return { label: 'Trovoada', kind: 'storm' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { label: 'Neve', kind: 'snow' };
  return { label: code < 60 ? 'Chuvisco' : 'Chuva', kind: 'rain' };
}
export function hourIndex(times: number[], now = Date.now()) {
  const index = times.findIndex(
    (t) => t * 1000 >= Math.floor(now / 3600000) * 3600000,
  );
  return index < 0 ? Math.max(0, times.length - 1) : index;
}
