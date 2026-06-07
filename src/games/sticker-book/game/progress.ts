import type { ProgressState } from '../types/game';

export const PROGRESS_STORAGE_KEY = 'sticker-book.progress.v1';

export function createInitialProgress(): ProgressState {
  return {
    discoveredVocabularyIds: [],
    scenarioVisits: {},
  };
}

export function markVocabularyDiscovered(progress: ProgressState, vocabId: string): ProgressState {
  if (progress.discoveredVocabularyIds.includes(vocabId)) {
    return progress;
  }

  return {
    ...progress,
    discoveredVocabularyIds: [...progress.discoveredVocabularyIds, vocabId],
  };
}

export function recordScenarioVisit(progress: ProgressState, scenarioId: string): ProgressState {
  return {
    ...progress,
    scenarioVisits: {
      ...progress.scenarioVisits,
      [scenarioId]: (progress.scenarioVisits[scenarioId] ?? 0) + 1,
    },
  };
}

export function loadProgress(storage: Storage = window.localStorage): ProgressState {
  try {
    const raw = storage.getItem(PROGRESS_STORAGE_KEY);

    if (!raw) {
      return createInitialProgress();
    }

    return sanitizeProgress(JSON.parse(raw));
  } catch {
    return createInitialProgress();
  }
}

export function saveProgress(
  progress: ProgressState,
  storage: Storage = window.localStorage
): void {
  storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
}

export function clearProgress(storage: Storage = window.localStorage): ProgressState {
  storage.removeItem(PROGRESS_STORAGE_KEY);
  return createInitialProgress();
}

function sanitizeProgress(value: unknown): ProgressState {
  if (!value || typeof value !== 'object') {
    return createInitialProgress();
  }

  const candidate = value as Partial<ProgressState>;
  const discoveredVocabularyIds = Array.isArray(candidate.discoveredVocabularyIds)
    ? candidate.discoveredVocabularyIds.filter((id): id is string => typeof id === 'string')
    : [];

  const scenarioVisits =
    candidate.scenarioVisits && typeof candidate.scenarioVisits === 'object'
      ? Object.fromEntries(
          Object.entries(candidate.scenarioVisits).filter(
            (entry): entry is [string, number] =>
              typeof entry[0] === 'string' && typeof entry[1] === 'number'
          )
        )
      : {};

  return {
    discoveredVocabularyIds,
    scenarioVisits,
  };
}
