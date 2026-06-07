import { Sticker } from 'lucide-react';
import { items, vocabulary } from '../data/content';
import type { Language, ProgressState } from '../types/game';

interface StickerJournalProps {
  language: Language;
  progress: ProgressState;
}

export function StickerJournal({ language, progress }: StickerJournalProps) {
  const discoveredEntries = vocabulary
    .filter((entry) => progress.discoveredVocabularyIds.includes(entry.id))
    .map((entry) => ({
      entry,
      item: items.find((candidate) => candidate.vocabId === entry.id),
    }));

  return (
    <section className="sticker-journal" aria-labelledby="journal-title">
      <div className="panel-heading">
        <h2 id="journal-title">Sticker journal</h2>
        <Sticker aria-hidden="true" size={20} />
      </div>

      {discoveredEntries.length > 0 ? (
        <div className="sticker-grid">
          {discoveredEntries.map(({ entry, item }) => (
            <div className="word-sticker" key={entry.id} data-testid={`sticker-${entry.id}`}>
              {item ? <img src={item.asset.path} alt="" draggable={false} /> : null}
              <span className="word-sticker-text">
                <strong>{language === 'en' ? entry.english : entry.korean}</strong>
                <span>{language === 'en' ? entry.korean : entry.english}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="journal-empty">No stickers yet</p>
      )}
    </section>
  );
}
