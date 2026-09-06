'use client';
import { useQuery } from '@tanstack/react-query';
import {
  forecastUrl,
  weatherResponseFromPayload,
} from '@/lib/weather/service';
import type { WeatherResponse } from '@/lib/weather/types';

let useProviderDirectly = false;

async function fetchProvider(signal: AbortSignal) {
  const response = await fetch(forecastUrl(), { signal, cache: 'no-store' });
  if (!response.ok)
    throw new Error(`Weather provider returned ${response.status}`);
  return weatherResponseFromPayload(await response.json());
}

export function useWeather() {
  return useQuery<WeatherResponse>({
    queryKey: ['portugal-weather'],
    queryFn: async ({ signal }) => {
      if (!useProviderDirectly) {
        try {
          const response = await fetch('/api/weather', { signal });
          if (response.ok) return response.json();
          useProviderDirectly = true;
        } catch (error) {
          if (signal.aborted) throw error;
          useProviderDirectly = true;
        }
      }
      try {
        return await fetchProvider(signal);
      } catch (error) {
        if (signal.aborted) throw error;
        throw new Error('A previsão está temporariamente indisponível.');
      }
    },
    staleTime: (query) =>
      Math.max(
        0,
        (query.state.data?.expiresAt ?? 0) -
          (query.state.dataUpdatedAt || Date.now()),
      ),
    refetchInterval: (query) =>
      query.state.error
        ? 300000
        : Math.max(
            1000,
            (query.state.data?.expiresAt ?? Date.now() + 3600000) - Date.now(),
          ),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
    retryDelay: 2000,
  });
}
