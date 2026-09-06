import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudFog,
  CloudRain,
  CloudLightning,
  Snowflake,
  CircleHelp,
} from 'lucide-react';
import { condition } from '@/lib/weather/format';
export default function WeatherIcon({
  code,
  day = 1,
  size = 24,
}: {
  code?: number | null;
  day?: number | null;
  size?: number;
}) {
  const kind = condition(code).kind;
  const icons: Record<string, typeof Sun> = {
    sun: day ? Sun : Moon,
    partly: day ? CloudSun : CloudMoon,
    cloud: Cloud,
    fog: CloudFog,
    rain: CloudRain,
    storm: CloudLightning,
    snow: Snowflake,
    unknown: CircleHelp,
  };
  const Icon = icons[kind] || Cloud;
  return (
    <Icon
      size={size}
      strokeWidth={1.5}
      className={`weather-icon weather-${kind}`}
      aria-hidden="true"
    />
  );
}
