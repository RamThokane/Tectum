import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';

/** How many Notebook flashcards are due today, and how many there are in total. */
export function useReviewSummary() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: ['reviews', 'summary'],
    queryFn: () => api.get('/reviews/summary').then((r) => r.data),
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });
}

/** Grade one card (again | hard | good | easy); the server schedules its next review (SM-2). */
export function useGradeCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, grade }) => api.post(`/reviews/${postId}`, { grade }).then((r) => r.data.card),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['reviews', 'summary'] });
      qc.invalidateQueries({ queryKey: ['activity'] }); // today's "Revise 5 flashcards" goal
    },
  });
}
