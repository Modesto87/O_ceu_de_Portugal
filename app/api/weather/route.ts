import { createWeatherService } from '@/lib/weather/service';

const getWeather = createWeatherService();
export async function GET(request: Request) {
  // Cloudflare's cache shares the hourly response across visitors in each region.
  const cache =
    typeof caches !== 'undefined'
      ? (caches as unknown as { default?: Cache }).default
      : undefined;
  const key = new Request(new URL('/api/weather?schema=3', request.url));
  try {
    const hit = await cache?.match(key);
    if (hit)
      return new Response(hit.body, {
        status: hit.status,
        headers: new Headers(hit.headers),
      });
    const data = await getWeather();
    const seconds = Math.max(
      1,
      Math.floor((data.expiresAt - Date.now()) / 1000),
    );
    const response = Response.json(data, {
      headers: {
        'Cache-Control': `public, max-age=${seconds}`,
        'X-Weather-Source': 'Open-Meteo',
        'X-Content-Type-Options': 'nosniff',
      },
    });
    try {
      await cache?.put(key, response.clone());
    } catch {
      /* Cache failures must not hide a valid forecast. */
    }
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
