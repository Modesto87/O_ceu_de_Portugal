export type WeatherValues = {
  temperature_2m: number | null;
  apparent_temperature: number | null;
  relative_humidity_2m: number | null;
  precipitation: number | null;
  weather_code: number | null;
  wind_speed_10m: number | null;
  wind_direction_10m: number | null;
  is_day: number | null;
  time: number;
};
export type Forecast = {
  current: WeatherValues;
  hourly: {
    time: number[];
    temperature_2m: (number | null)[];
    apparent_temperature: (number | null)[];
    relative_humidity_2m: (number | null)[];
    precipitation_probability: (number | null)[];
    weather_code: (number | null)[];
    wind_speed_10m: (number | null)[];
    is_day: (number | null)[];
  };
  daily: {
    time: number[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    weather_code: (number | null)[];
    precipitation_probability_max: (number | null)[];
    sunrise: number[];
    sunset: number[];
    uv_index_max: (number | null)[];
  };
};
export type WeatherResponse = {
  source?: 'open-meteo' | 'met-no';
  fetchedAt: number;
  expiresAt: number;
  districts: Record<string, Forecast>;
  sea?: Record<string, number | null>;
};
export type Layer = 'temperature' | 'rain' | 'wind' | 'sea';
