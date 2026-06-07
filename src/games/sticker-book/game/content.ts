import { characters, items, scenarios, vocabulary } from '../data/content';
import type { Character, Item, PercentPoint, Scenario, VocabularyEntry } from '../types/game';

export function getScenario(scenarioId: string): Scenario {
  const scenario = scenarios.find((candidate) => candidate.id === scenarioId);

  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }

  return scenario;
}

export function getItem(itemId: string): Item {
  const item = items.find((candidate) => candidate.id === itemId);

  if (!item) {
    throw new Error(`Unknown item: ${itemId}`);
  }

  return item;
}

export function getCharacter(characterId: string): Character {
  const character = characters.find((candidate) => candidate.id === characterId);

  if (!character) {
    throw new Error(`Unknown character: ${characterId}`);
  }

  return character;
}

export function getVocabularyEntry(vocabId: string): VocabularyEntry {
  const entry = vocabulary.find((candidate) => candidate.id === vocabId);

  if (!entry) {
    throw new Error(`Unknown vocabulary entry: ${vocabId}`);
  }

  return entry;
}

export function getScenarioItems(scenario: Scenario): Item[] {
  return [...scenario.items]
    .sort((left, right) => left.trayOrder - right.trayOrder)
    .map((scenarioItem) => getItem(scenarioItem.itemId));
}

export function toStagePoint(rect: DOMRect, clientX: number, clientY: number): PercentPoint {
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;

  return {
    x: clampPercent(x),
    y: clampPercent(y),
  };
}

export function isPointInsideStage(rect: DOMRect, clientX: number, clientY: number): boolean {
  return (
    clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  );
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}
