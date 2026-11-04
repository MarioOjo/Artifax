export type QueueJobStatus = 'Queued' | 'Active' | 'Paused';

export function normalizeQueueStatus(status?: string): QueueJobStatus | null {
  const normalized = (status ?? '').trim().toLowerCase();

  if (normalized === 'active' || normalized === 'in progress') return 'Active';
  if (normalized === 'paused') return 'Paused';
  if (normalized === 'queued' || normalized === 'pending') return 'Queued';

  return null;
}

// The backend already advances expedited orders at double speed (TimeElapsed += 2 per minute),
// so progress is always elapsed / total; expediting only shortens the real time left.
export function calculateProgress(totalTime?: number, timeElapsed?: number): number {
  if (totalTime == null || totalTime <= 0 || timeElapsed == null) return 0;
  return Math.min(100, Math.max(0, Math.round((timeElapsed / totalTime) * 100)));
}

export function formatTimeLeft(totalTime?: number, timeElapsed?: number, expedited = false): string {
  if (totalTime == null || timeElapsed == null) {
    return 'No estimate';
  }

  const remaining = Math.max(0, totalTime - timeElapsed) / (expedited ? 2 : 1);
  return remaining === 0 ? 'Complete' : `${Math.ceil(remaining)} min left`;
}
