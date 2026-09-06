import { createWeatherService } from '@/lib/weather/service';

const getWeather = createWeatherService();
export async function GET() {
  try {
    const data = await getWeather();
    const seconds = Math.max(
      1,
      Math.floor((data.expiresAt - Date.now()) / 1000),
    );
    const response = Response.json(data, {
      headers: {
        'Cache-Control': `public, max-age=${seconds}, s-maxage=${seconds}`,
        'X-Weather-Source': 'Open-Meteo',
        'X-Content-Type-Options': 'nosniff',
      },
    });
    return response;
  } catch (error) {
    console.error(
      'Weather request failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return Response.json(
      {
        error:
          'Não foi possível obter a previsão. Tente novamente dentro de alguns minutos.',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '300' },
      },
    );
  }
}
