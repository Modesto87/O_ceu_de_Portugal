'use client';
import { useQuery } from '@tanstack/react-query';
import type { WeatherResponse } from '@/lib/weather/types';

export function useWeather() {
  return useQuery<WeatherResponse>({
    queryKey: ['portugal-weather'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/weather', { signal });
      if (!response.ok)
        throw new Error('A previsão está temporariamente indisponível.');
      return response.json();
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
