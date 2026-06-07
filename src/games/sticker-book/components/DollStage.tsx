import { Minus, Plus } from 'lucide-react';
import { getCharacter, getItem, getVocabularyEntry } from '../game/content';
import { findTopmostHitPlacement } from '../game/hitTest';
import type { Language, PlacedSticker, Scenario, StageDragState } from '../types/game';

interface DollStageProps {
  scenario: Scenario;
  placements: PlacedSticker[];
  dragState: StageDragState | null;
  selectedPlacementId: string | null;
  showResizeControls: boolean;
  canShrinkSelected: boolean;
  canGrowSelected: boolean;
  resizeStep: number;
  language: Language;
  stageRef: React.RefObject<HTMLDivElement | null>;
  onStagePointerDown: (
    event: React.PointerEvent<HTMLDivElement>,
    placement: PlacedSticker | null,
    sourceRect: DOMRect | null
  ) => void;
  onResizeSelected: (delta: number) => void;
}

export function DollStage({
  scenario,
  placements,
  dragState,
  selectedPlacementId,
  showResizeControls,
  canShrinkSelected,
  canGrowSelected,
  resizeStep,
  language,
  stageRef,
  onStagePointerDown,
  onResizeSelected,
}: DollStageProps) {
  const handleStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    const stageRect = stageRef.current?.getBoundingClientRect();

    if (!stageRect) {
      return;
    }

    const hit = findTopmostHitPlacement(placements, stageRect, event.clientX, event.clientY);

    if (hit) {
      event.preventDefault();
      onStagePointerDown(event, hit.placement, hit.rect);
      return;
    }

    onStagePointerDown(event, null, null);
  };

  const dragGhostAssetPath = dragState ? getDragAssetPath(dragState) : null;
  const selectedPlacement = showResizeControls
    ? (placements.find((placement) => placement.id === selectedPlacementId) ?? null)
    : null;

  return (
    <section className="stage-shell" aria-label={`${scenario.title[language]} stage`}>
      <div
        className="stage"
        ref={stageRef}
        onPointerDown={handleStagePointerDown}
        data-testid="doll-stage"
      >
        <img
          className="stage-background"
          src={scenario.background.path}
          alt={scenario.background.alt}
          draggable={false}
        />

        {placements
          .filter(
            (placement) =>
              !(
                dragState?.source === 'stage' &&
                dragState.hasMoved &&
                placement.id === dragState.placementId
              )
          )
          .map((placement) => {
            const sticker = getStickerView(placement, language);

            return (
              <button
                key={placement.id}
                type="button"
                className={`placed-item placed-${placement.kind}${
                  placement.id === selectedPlacementId ? ' is-selected' : ''
                }`}
                style={{
                  left: formatPercent(placement.x),
                  top: formatPercent(placement.y),
                  transform: `translate(-50%, -50%) scale(${placement.scale ?? 1})`,
                }}
                aria-label={sticker.label}
                data-testid={`placed-${placement.kind}-${placement.stickerId}`}
                data-placement-id={placement.id}
              >
                <img src={sticker.assetPath} alt="" draggable={false} />
              </button>
            );
          })}

        {selectedPlacement ? (
          <div
            className="resize-toolbar"
            style={{
              left: `clamp(56px, ${formatPercent(selectedPlacement.x)}, calc(100% - 56px))`,
              top: `max(58px, calc(${formatPercent(selectedPlacement.y)} - 56px))`,
            }}
            onPointerDown={stopStageEvent}
            onClick={stopStageEvent}
            onKeyDown={stopStageEvent}
            data-testid="sticker-resize-toolbar"
            role="toolbar"
            aria-label="Sticker size controls"
          >
            <button
              type="button"
              aria-label="Make sticker smaller"
              disabled={!canShrinkSelected}
              onClick={(event) => {
                event.stopPropagation();
                onResizeSelected(-resizeStep);
              }}
              data-testid="resize-smaller"
            >
              <Minus aria-hidden="true" size={21} strokeWidth={3} />
            </button>
            <button
              type="button"
              aria-label="Make sticker bigger"
              disabled={!canGrowSelected}
              onClick={(event) => {
                event.stopPropagation();
                onResizeSelected(resizeStep);
              }}
              data-testid="resize-bigger"
            >
              <Plus aria-hidden="true" size={21} strokeWidth={3} />
            </button>
          </div>
        ) : null}
      </div>

      {dragState?.hasMoved ? (
        <div
          className="drag-ghost"
          data-testid="drag-ghost"
          style={{
            width: `${dragState.width}px`,
            height: `${dragState.height}px`,
            transform: `translate(${dragState.clientX - dragState.offsetX}px, ${
              dragState.clientY - dragState.offsetY
            }px)`,
          }}
          aria-hidden="true"
        >
          <img src={dragGhostAssetPath ?? ''} alt="" draggable={false} />
        </div>
      ) : null}
    </section>
  );
}

function stopStageEvent(
  event:
    | React.PointerEvent<HTMLDivElement>
    | React.MouseEvent<HTMLDivElement>
    | React.KeyboardEvent<HTMLDivElement>
) {
  event.stopPropagation();
}

function formatPercent(value: number): string {
  return `${Number(value.toFixed(4))}%`;
}

function getStickerView(
  placement: PlacedSticker,
  language: Language
): { assetPath: string; label: string } {
  if (placement.kind === 'character') {
    const character = getCharacter(placement.stickerId);
    return { assetPath: character.asset.path, label: character.name };
  }

  const item = getItem(placement.stickerId);
  const vocab = getVocabularyEntry(item.vocabId);
  return {
    assetPath: item.asset.path,
    label: language === 'en' ? vocab.english : vocab.korean,
  };
}

function getDragAssetPath(dragState: StageDragState): string {
  return dragState.kind === 'item'
    ? getItem(dragState.stickerId).asset.path
    : getCharacter(dragState.stickerId).asset.path;
}
