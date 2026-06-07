export type Language = 'en' | 'ko';

export type TrayDock = 'left' | 'right' | 'bottom';

export type AssetKind = 'background' | 'character' | 'item' | 'audio' | 'music';

export interface AssetRef {
  id: string;
  kind: AssetKind;
  path: string;
  alt: string;
}

export interface VocabularyEntry {
  id: string;
  english: string;
  korean: string;
  romanization?: string;
  audio: Record<Language, AssetRef | null>;
}

export type ItemCategory = 'food' | 'container' | 'clothing' | 'toy' | 'tableware' | 'scene';

export interface PercentPoint {
  x: number;
  y: number;
}

export interface Item {
  id: string;
  vocabId: string;
  category: ItemCategory;
  asset: AssetRef;
}

export interface ScenarioItem {
  itemId: string;
  trayOrder: number;
}

export interface Scenario {
  id: string;
  title: Record<Language, string>;
  summary: string;
  background: AssetRef;
  music: AssetRef | null;
  status: 'playable' | 'planned';
  items: ScenarioItem[];
}

export interface Character {
  id: string;
  name: string;
  asset: AssetRef;
  description: string;
}

export interface PlacedItem {
  id: string;
  kind: 'item';
  stickerId: string;
  x: number;
  y: number;
  scale?: number;
}

export interface PlacedCharacter {
  id: string;
  kind: 'character';
  stickerId: string;
  x: number;
  y: number;
  scale?: number;
}

export type PlacedSticker = PlacedItem | PlacedCharacter;

interface DragStateBase {
  pointerId: number;
  initialClientX: number;
  initialClientY: number;
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  hasMoved: boolean;
}

export type StageDragState =
  | (DragStateBase & {
      kind: 'item';
      stickerId: string;
      source: 'stage' | 'tray';
      placementId?: string;
    })
  | (DragStateBase & {
      kind: 'character';
      stickerId: string;
      source: 'stage' | 'tray';
      placementId?: string;
    });

export interface ProgressState {
  discoveredVocabularyIds: string[];
  scenarioVisits: Record<string, number>;
}
