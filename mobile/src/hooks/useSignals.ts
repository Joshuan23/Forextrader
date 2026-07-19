import { useQuery } from '@tanstack/react-query'
import { fetchSignals } from '@/api/client'

export function useSignals() {
  return useQuery({
    queryKey: ['signals'],
    queryFn: fetchSignals,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })
}
