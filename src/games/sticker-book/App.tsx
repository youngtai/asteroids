import { PanelBottom, PanelLeft, PanelRight, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioEngine } from './audio/audio';
import { DollStage } from './components/DollStage';
import { ItemTray } from './components/ItemTray';
import { LanguageToggle } from './components/LanguageToggle';
import { ScenarioSelector } from './components/ScenarioSelector';
import { characters } from './data/content';
import {
  getScenario,
  getScenarioItems,
  getVocabularyEntry,
  isPointInsideStage,
  toStagePoint,
} from './game/content';
import { getStageCharacterDimensions, getStageStickerSize } from './game/hitTest';
import {
  clearProgress,
  loadProgress,
  markVocabularyDiscovered,
  recordScenarioVisit,
  saveProgress,
} from './game/progress';
import type {
  Item,
  Language,
  PlacedSticker,
  ProgressState,
  StageDragState,
  TrayDock,
} from './types/game';

const MIN_STICKER_SCALE = 0.55;
const MAX_STICKER_SCALE = 2.25;
const STICKER_SCALE_STEP = 0.15;
const TRAY_DRAG_INTENT_THRESHOLD = 12;
const TRAY_DRAG_INTENT_MARGIN = 6;

interface ActivePointer {
  clientX: number;
  clientY: number;
}

interface PendingEmptyStageTap {
  pointerId: number;
  initialClientX: number;
  initialClientY: number;
  hasMoved: boolean;
}

interface PinchState {
  placementId: string;
  pointerIds: [number, number];
  initialDistance: number;
  initialScale: number;
  hasChanged: boolean;
}

interface DockDragState {
  pointerId: number;
  clientX: number;
  clientY: number;
  hoverDock: TrayDock | null;
}

interface PendingTrayDrag {
  kind: 'item' | 'character';
  stickerId: string;
  pointerId: number;
  initialClientX: number;
  initialClientY: number;
  element: HTMLButtonElement;
  scrollAxis: 'x' | 'y';
}

const dockDropTargets = [
  { dock: 'left', label: 'Move sticker tray left', Icon: PanelLeft },
  { dock: 'right', label: 'Move sticker tray right', Icon: PanelRight },
  { dock: 'bottom', label: 'Move sticker tray bottom', Icon: PanelBottom },
] satisfies Array<{ dock: TrayDock; label: string; Icon: typeof PanelRight }>;

export function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [activeScenarioId, setActiveScenarioId] = useState('picnic');
  const [placements, setPlacements] = useState<PlacedSticker[]>([]);
  const [_progress, setProgress] = useState<ProgressState>(() => loadProgress());
  const [dragState, setDragState] = useState<StageDragState | null>(null);
  const [pinchState, setPinchState] = useState<PinchState | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [trayDock, setTrayDock] = useState<TrayDock>('right');
  const [dockDragState, setDockDragState] = useState<DockDragState | null>(null);
  const [pendingTrayDrag, setPendingTrayDrag] = useState<PendingTrayDrag | null>(null);
  const activeStagePointers = useRef(new Map<number, ActivePointer>());
  const pendingEmptyStageTap = useRef<PendingEmptyStageTap | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const nextPlacementId = useRef(1);

  const scenario = useMemo(() => getScenario(activeScenarioId), [activeScenarioId]);
  const scenarioItems = useMemo(() => getScenarioItems(scenario), [scenario]);

  useEffect(() => {
    audioEngine.setMusicForScenario(scenario);
    setProgress((current) => {
      const next = recordScenarioVisit(current, scenario.id);
      saveProgress(next);
      return next;
    });
  }, [scenario]);

  const updateLanguage = useCallback((nextLanguage: Language) => {
    setLanguage(nextLanguage);
    audioEngine.playSfx('language');
  }, []);

  const startDockDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedPlacementId(null);
    setDockDragState({
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      hoverDock: null,
    });
    audioEngine.playSfx('pickup');
  }, []);

  const beginTrayStickerDrag = useCallback(
    (
      kind: 'item' | 'character',
      stickerId: string,
      element: HTMLButtonElement,
      pointerId: number,
      initialClientX: number,
      initialClientY: number,
      clientX = initialClientX,
      clientY = initialClientY,
      hasMoved = false
    ) => {
      audioEngine.prepareForInteraction();
      setSelectedPlacementId(null);
      element.setPointerCapture?.(pointerId);
      const dragMetrics =
        kind === 'item'
          ? getElementDragMetrics(element, initialClientX, initialClientY)
          : getCharacterDragMetrics(stickerId, element, initialClientX, initialClientY);

      setDragState({
        kind,
        stickerId,
        source: 'tray',
        pointerId,
        initialClientX,
        initialClientY,
        clientX,
        clientY,
        ...dragMetrics,
        hasMoved,
      });
      audioEngine.playSfx('pickup');
    },
    []
  );

  const startTrayStickerInteraction = useCallback(
    (
      kind: 'item' | 'character',
      stickerId: string,
      event: React.PointerEvent<HTMLButtonElement>
    ) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      if (event.pointerType === 'touch') {
        audioEngine.prepareForInteraction();
        setPendingTrayDrag({
          kind,
          stickerId,
          pointerId: event.pointerId,
          initialClientX: event.clientX,
          initialClientY: event.clientY,
          element: event.currentTarget,
          scrollAxis: getTrayScrollAxis(trayDock),
        });
        return;
      }

      beginTrayStickerDrag(
        kind,
        stickerId,
        event.currentTarget,
        event.pointerId,
        event.clientX,
        event.clientY
      );
    },
    [beginTrayStickerDrag, trayDock]
  );

  const startTrayDrag = useCallback(
    (itemId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      startTrayStickerInteraction('item', itemId, event);
    },
    [startTrayStickerInteraction]
  );

  const startCharacterTrayDrag = useCallback(
    (characterId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      startTrayStickerInteraction('character', characterId, event);
    },
    [startTrayStickerInteraction]
  );

  const maybeStartSelectedPinch = useCallback((): boolean => {
    if (!selectedPlacementId || activeStagePointers.current.size < 2) {
      return false;
    }

    const placement = placements.find((candidate) => candidate.id === selectedPlacementId);
    const pointerIds = Array.from(activeStagePointers.current.keys()).slice(-2) as [number, number];
    const firstPointer = activeStagePointers.current.get(pointerIds[0]);
    const secondPointer = activeStagePointers.current.get(pointerIds[1]);
    const initialDistance =
      firstPointer && secondPointer ? getPointerDistance(firstPointer, secondPointer) : 0;

    if (!placement || initialDistance <= 0) {
      return false;
    }

    pendingEmptyStageTap.current = null;
    setPinchState({
      placementId: placement.id,
      pointerIds,
      initialDistance,
      initialScale: placement.scale ?? 1,
      hasChanged: false,
    });
    setDragState(null);
    return true;
  }, [placements, selectedPlacementId]);

  const startStageInteraction = useCallback(
    (
      event: React.PointerEvent<HTMLDivElement>,
      placement: PlacedSticker | null,
      sourceRect: DOMRect | null
    ) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      audioEngine.prepareForInteraction();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      activeStagePointers.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });

      if (event.pointerType !== 'mouse' && maybeStartSelectedPinch()) {
        return;
      }

      if (!placement || !sourceRect) {
        pendingEmptyStageTap.current = {
          pointerId: event.pointerId,
          initialClientX: event.clientX,
          initialClientY: event.clientY,
          hasMoved: false,
        };
        return;
      }

      setSelectedPlacementId(placement.id);
      const dragMetrics = getRectDragMetrics(sourceRect, event.clientX, event.clientY);

      setDragState({
        kind: placement.kind,
        stickerId: placement.stickerId,
        source: 'stage',
        placementId: placement.id,
        pointerId: event.pointerId,
        initialClientX: event.clientX,
        initialClientY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        ...dragMetrics,
        hasMoved: false,
      });
      audioEngine.playSfx('pickup');
    },
    [maybeStartSelectedPinch]
  );

  const selectedPlacement = useMemo(
    () => placements.find((placement) => placement.id === selectedPlacementId) ?? null,
    [placements, selectedPlacementId]
  );
  const selectedScale = selectedPlacement?.scale ?? 1;
  const canShrinkSelected = Boolean(selectedPlacement) && selectedScale > MIN_STICKER_SCALE;
  const canGrowSelected = Boolean(selectedPlacement) && selectedScale < MAX_STICKER_SCALE;

  const resizeSelectedSticker = useCallback(
    (delta: number) => {
      setPlacements((current) =>
        current.map((placement) =>
          placement.id === selectedPlacementId
            ? { ...placement, scale: clampScale((placement.scale ?? 1) + delta) }
            : placement
        )
      );
    },
    [selectedPlacementId]
  );

  const speakItem = useCallback(
    (item: Item) => {
      const vocab = getVocabularyEntry(item.vocabId);
      audioEngine.playVocabulary(vocab, language);
      setProgress((current) => {
        const next = markVocabularyDiscovered(current, vocab.id);
        saveProgress(next);

        if (next !== current) {
          audioEngine.playSfx('sticker');
        }

        return next;
      });
    },
    [language]
  );

  const resetProgress = useCallback(() => {
    setProgress(clearProgress());
    setPlacements([]);
    nextPlacementId.current = 1;
    activeStagePointers.current.clear();
    pendingEmptyStageTap.current = null;
    setPendingTrayDrag(null);
    setDragState(null);
    setPinchState(null);
    setSelectedPlacementId(null);
  }, []);

  useEffect(() => {
    if (!activeScenarioId) {
      return;
    }

    activeStagePointers.current.clear();
    pendingEmptyStageTap.current = null;
    setPendingTrayDrag(null);
    setDragState(null);
    setPinchState(null);
    setSelectedPlacementId(null);
  }, [activeScenarioId]);

  useEffect(() => {
    if (!pendingTrayDrag) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pendingTrayDrag.pointerId) {
        return;
      }

      const deltaX = event.clientX - pendingTrayDrag.initialClientX;
      const deltaY = event.clientY - pendingTrayDrag.initialClientY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      const scrollDistance = pendingTrayDrag.scrollAxis === 'x' ? absDeltaX : absDeltaY;
      const dragDistance = pendingTrayDrag.scrollAxis === 'x' ? absDeltaY : absDeltaX;

      if (
        scrollDistance > TRAY_DRAG_INTENT_THRESHOLD &&
        scrollDistance > dragDistance + TRAY_DRAG_INTENT_MARGIN
      ) {
        setPendingTrayDrag(null);
        return;
      }

      if (
        dragDistance > TRAY_DRAG_INTENT_THRESHOLD &&
        dragDistance > scrollDistance + TRAY_DRAG_INTENT_MARGIN
      ) {
        beginTrayStickerDrag(
          pendingTrayDrag.kind,
          pendingTrayDrag.stickerId,
          pendingTrayDrag.element,
          pendingTrayDrag.pointerId,
          pendingTrayDrag.initialClientX,
          pendingTrayDrag.initialClientY,
          event.clientX,
          event.clientY,
          true
        );
        setPendingTrayDrag(null);
      }
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId === pendingTrayDrag.pointerId) {
        setPendingTrayDrag(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [beginTrayStickerDrag, pendingTrayDrag]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (activeStagePointers.current.has(event.pointerId)) {
        activeStagePointers.current.set(event.pointerId, {
          clientX: event.clientX,
          clientY: event.clientY,
        });
      }

      const pendingTap = pendingEmptyStageTap.current;

      if (pendingTap?.pointerId === event.pointerId) {
        pendingEmptyStageTap.current = {
          ...pendingTap,
          hasMoved:
            pendingTap.hasMoved ||
            Math.hypot(
              event.clientX - pendingTap.initialClientX,
              event.clientY - pendingTap.initialClientY
            ) > 4,
        };
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      activeStagePointers.current.delete(event.pointerId);
      const pendingTap = pendingEmptyStageTap.current;

      if (pendingTap?.pointerId === event.pointerId) {
        pendingEmptyStageTap.current = null;

        if (!pendingTap.hasMoved) {
          setSelectedPlacementId(null);
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return;
      }

      activeStagePointers.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      setDragState((current) =>
        current
          ? {
              ...current,
              clientX: event.clientX,
              clientY: event.clientY,
              hasMoved:
                current.hasMoved ||
                Math.hypot(
                  event.clientX - current.initialClientX,
                  event.clientY - current.initialClientY
                ) > 4,
            }
          : null
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return;
      }

      activeStagePointers.current.delete(event.pointerId);
      const stageRect = stageRef.current?.getBoundingClientRect();
      const item =
        dragState.kind === 'item'
          ? scenarioItems.find((candidate) => candidate.id === dragState.stickerId)
          : null;

      setDragState(null);

      if (!dragState.hasMoved) {
        if (dragState.kind === 'item' && dragState.source === 'stage' && item) {
          speakItem(item);
        }

        return;
      }

      if (!stageRect || stageRect.width === 0 || stageRect.height === 0) {
        audioEngine.playSfx('return');
        return;
      }

      if (!isPointInsideStage(stageRect, event.clientX, event.clientY)) {
        if (dragState.source === 'stage' && dragState.placementId) {
          setPlacements((current) =>
            current.filter((placement) => placement.id !== dragState.placementId)
          );
          setSelectedPlacementId((current) => (current === dragState.placementId ? null : current));
          audioEngine.playSfx('return');
          return;
        }

        audioEngine.playSfx('return');
        return;
      }

      const stickerCenterX = event.clientX - dragState.offsetX + dragState.width / 2;
      const stickerCenterY = event.clientY - dragState.offsetY + dragState.height / 2;
      const point = toStagePoint(stageRect, stickerCenterX, stickerCenterY);

      if (dragState.kind === 'item' && !item) {
        audioEngine.playSfx('return');
        return;
      }

      if (dragState.source === 'stage' && dragState.placementId) {
        setSelectedPlacementId(dragState.placementId);
        setPlacements((current) =>
          current.map((placement) =>
            placement.id === dragState.placementId
              ? { ...placement, x: point.x, y: point.y }
              : placement
          )
        );
      } else {
        const placementId = `${dragState.kind}-${dragState.stickerId}-${nextPlacementId.current++}`;
        setSelectedPlacementId(placementId);
        setPlacements((current) => [
          ...current,
          {
            id: placementId,
            kind: dragState.kind,
            stickerId: dragState.stickerId,
            x: point.x,
            y: point.y,
          } as PlacedSticker,
        ]);
      }

      if (item) {
        speakItem(item);
      }

      audioEngine.playSfx('placed');
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragState, scenarioItems, speakItem]);

  useEffect(() => {
    if (!pinchState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!pinchState.pointerIds.includes(event.pointerId)) {
        return;
      }

      activeStagePointers.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      const [firstPointerId, secondPointerId] = pinchState.pointerIds;
      const firstPointer = activeStagePointers.current.get(firstPointerId);
      const secondPointer = activeStagePointers.current.get(secondPointerId);

      if (!firstPointer || !secondPointer) {
        return;
      }

      const distance = getPointerDistance(firstPointer, secondPointer);
      const nextScale = clampScale(
        (pinchState.initialScale * distance) / pinchState.initialDistance
      );

      setPlacements((current) =>
        current.map((placement) =>
          placement.id === pinchState.placementId ? { ...placement, scale: nextScale } : placement
        )
      );
      setPinchState((current) => (current ? { ...current, hasChanged: true } : current));
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!pinchState.pointerIds.includes(event.pointerId)) {
        return;
      }

      pinchState.pointerIds.forEach((pointerId) => {
        activeStagePointers.current.delete(pointerId);
      });
      setPinchState(null);

      if (pinchState.hasChanged) {
        audioEngine.playSfx('placed');
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [pinchState]);

  useEffect(() => {
    if (!dockDragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dockDragState.pointerId) {
        return;
      }

      setDockDragState((current) =>
        current
          ? {
              ...current,
              clientX: event.clientX,
              clientY: event.clientY,
              hoverDock: getDockTargetFromPoint(event.clientX, event.clientY),
            }
          : current
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== dockDragState.pointerId) {
        return;
      }

      const nextDock = getDockTargetFromPoint(event.clientX, event.clientY);

      setDockDragState(null);

      if (nextDock === 'left' || nextDock === 'right' || nextDock === 'bottom') {
        setTrayDock(nextDock);
        audioEngine.playSfx('placed');
      } else {
        audioEngine.playSfx('return');
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dockDragState]);

  return (
    <main
      className={`sticker-book-root app-shell tray-dock-${trayDock}${dockDragState ? ' is-dock-dragging' : ''}${
        dockDragState?.hoverDock ? ` dock-preview-${dockDragState.hoverDock}` : ''
      }`}
    >
      <header className="top-bar">
        <ScenarioSelector
          activeScenarioId={scenario.id}
          language={language}
          onSelect={setActiveScenarioId}
        />
        <div className="top-actions">
          <LanguageToggle language={language} onChange={updateLanguage} />
          <button
            className="reset-button reset-button-compact"
            type="button"
            onClick={resetProgress}
          >
            <RotateCcw aria-hidden="true" size={18} />
            Reset
          </button>
        </div>
      </header>

      <div className="game-layout">
        <DollStage
          scenario={scenario}
          placements={placements}
          dragState={dragState}
          selectedPlacementId={selectedPlacementId}
          showResizeControls={Boolean(selectedPlacementId) && !dragState && !pinchState}
          canShrinkSelected={canShrinkSelected}
          canGrowSelected={canGrowSelected}
          resizeStep={STICKER_SCALE_STEP}
          language={language}
          stageRef={stageRef}
          onStagePointerDown={startStageInteraction}
          onResizeSelected={resizeSelectedSticker}
        />

        {dockDragState ? (
          <section
            className="dock-drop-layer"
            aria-label="Sticker tray dock targets"
            data-testid="dock-drop-layer"
          >
            {dockDropTargets.map(({ dock, label, Icon }) => (
              <button
                key={dock}
                type="button"
                className={`dock-drop-target dock-drop-target-${dock}${trayDock === dock ? ' is-current' : ''}${
                  dockDragState.hoverDock === dock ? ' is-hovered' : ''
                }`}
                aria-label={label}
                data-dock-target={dock}
                data-testid={`dock-drop-target-${dock}`}
              >
                <Icon aria-hidden="true" size={28} />
                <span>{dock}</span>
              </button>
            ))}
          </section>
        ) : null}

        <aside className="side-panel" aria-label="Game tools">
          <button
            type="button"
            className={`dock-drag-handle dock-drag-handle-${trayDock}${dockDragState ? ' is-dragging' : ''}`}
            aria-label={`Move sticker tray from ${trayDock} dock`}
            aria-describedby="dock-handle-help"
            title="Move sticker tray"
            onPointerDown={startDockDrag}
            data-testid="dock-drag-handle"
          >
            <span className="dock-handle-dots" aria-hidden="true" />
          </button>
          <span id="dock-handle-help" className="sr-only">
            Drag to the left, right, or bottom target to move the sticker tray.
          </span>
          <ItemTray
            characters={characters}
            items={scenarioItems}
            language={language}
            onStartCharacterDrag={startCharacterTrayDrag}
            onStartDrag={startTrayDrag}
            onPreview={speakItem}
          />
        </aside>
      </div>
    </main>
  );
}

function getElementDragMetrics(element: HTMLButtonElement, clientX: number, clientY: number) {
  const sourceRect = getDragSourceRect(element, clientX, clientY);
  const size = getStageStickerSize();
  return getRectDragMetrics(sourceRect, clientX, clientY, size, size);
}

function getCharacterDragMetrics(
  characterId: string,
  element: HTMLButtonElement,
  clientX: number,
  clientY: number
) {
  const sourceRect = getDragSourceRect(element, clientX, clientY);
  const dimensions = getStageCharacterDimensions(characterId);
  return getRectDragMetrics(sourceRect, clientX, clientY, dimensions.width, dimensions.height);
}

function getRectDragMetrics(
  sourceRect: DOMRect,
  clientX: number,
  clientY: number,
  width = sourceRect.width,
  height = sourceRect.height
) {
  const relativeX = sourceRect.width > 0 ? (clientX - sourceRect.left) / sourceRect.width : 0.5;
  const relativeY = sourceRect.height > 0 ? (clientY - sourceRect.top) / sourceRect.height : 0.5;

  return {
    offsetX: clamp(relativeX, 0, 1) * width,
    offsetY: clamp(relativeY, 0, 1) * height,
    width,
    height,
  };
}

function getPointerDistance(firstPointer: ActivePointer, secondPointer: ActivePointer): number {
  return Math.hypot(
    firstPointer.clientX - secondPointer.clientX,
    firstPointer.clientY - secondPointer.clientY
  );
}

function clampScale(scale: number): number {
  const clampedScale = Math.min(MAX_STICKER_SCALE, Math.max(MIN_STICKER_SCALE, scale));
  return Math.round(clampedScale * 100) / 100;
}

function getDockTargetFromPoint(clientX: number, clientY: number): TrayDock | null {
  const targetElement = document.elementFromPoint?.(clientX, clientY);
  const dockTarget = targetElement?.closest<HTMLElement>('[data-dock-target]');
  const dock = dockTarget?.dataset.dockTarget;
  return dock === 'left' || dock === 'right' || dock === 'bottom' ? dock : null;
}

function getTrayScrollAxis(trayDock: TrayDock): 'x' | 'y' {
  return trayDock === 'bottom' ? 'x' : 'y';
}

function getDragSourceRect(element: HTMLButtonElement, clientX: number, clientY: number): DOMRect {
  const imageRect = element.querySelector('img')?.getBoundingClientRect();

  if (
    imageRect &&
    clientX >= imageRect.left &&
    clientX <= imageRect.right &&
    clientY >= imageRect.top &&
    clientY <= imageRect.bottom
  ) {
    return imageRect;
  }

  return element.getBoundingClientRect();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
