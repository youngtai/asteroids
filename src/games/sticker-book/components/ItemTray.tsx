import { getVocabularyEntry } from '../game/content';
import type { Character, Item, Language } from '../types/game';

interface ItemTrayProps {
  characters: Character[];
  items: Item[];
  language: Language;
  onStartCharacterDrag: (characterId: string, event: React.PointerEvent<HTMLButtonElement>) => void;
  onStartDrag: (itemId: string, event: React.PointerEvent<HTMLButtonElement>) => void;
  onPreview: (item: Item) => void;
}

export function ItemTray({
  characters,
  items,
  language,
  onStartCharacterDrag,
  onStartDrag,
  onPreview,
}: ItemTrayProps) {
  return (
    <section className="item-tray" aria-labelledby="tray-title">
      <h2 id="tray-title" className="sr-only">
        Stickers
      </h2>
      <p className="tray-group-title">People</p>
      <div className="tray-grid character-tray-grid">
        {characters.map((character) => (
          <button
            key={character.id}
            className="tray-item tray-character"
            type="button"
            onPointerDown={(event) => onStartCharacterDrag(character.id, event)}
            data-testid={`tray-character-${character.id}`}
          >
            <img src={character.asset.path} alt="" draggable={false} />
            <span>{character.name}</span>
          </button>
        ))}
      </div>
      <p className="tray-group-title">Things</p>
      <div className="tray-grid">
        {items.map((item) => {
          const vocab = getVocabularyEntry(item.vocabId);
          const label = language === 'en' ? vocab.english : vocab.korean;

          return (
            <button
              key={item.id}
              className="tray-item"
              type="button"
              onPointerDown={(event) => onStartDrag(item.id, event)}
              onClick={() => onPreview(item)}
              data-testid={`tray-item-${item.id}`}
            >
              <img src={item.asset.path} alt="" draggable={false} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
