import { MapPinned } from 'lucide-react';
import { scenarios } from '../data/content';
import type { Language } from '../types/game';

interface ScenarioSelectorProps {
  activeScenarioId: string;
  language: Language;
  onSelect: (scenarioId: string) => void;
}

export function ScenarioSelector({ activeScenarioId, language, onSelect }: ScenarioSelectorProps) {
  return (
    <nav className="scenario-selector" aria-label="Scenarios">
      <MapPinned aria-hidden="true" size={21} />
      {scenarios.map((scenario) => (
        <button
          key={scenario.id}
          type="button"
          className={scenario.id === activeScenarioId ? 'is-active' : ''}
          disabled={scenario.status !== 'playable'}
          onClick={() => onSelect(scenario.id)}
          data-testid={`scenario-${scenario.id}`}
        >
          <span>{scenario.title[language]}</span>
          {scenario.status === 'planned' ? <small>soon</small> : null}
        </button>
      ))}
    </nav>
  );
}
