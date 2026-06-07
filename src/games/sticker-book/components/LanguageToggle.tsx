import { Languages } from 'lucide-react';
import type { Language } from '../types/game';

interface LanguageToggleProps {
  language: Language;
  onChange: (language: Language) => void;
}

export function LanguageToggle({ language, onChange }: LanguageToggleProps) {
  return (
    <fieldset className="language-toggle">
      <legend className="sr-only">Language</legend>
      <Languages aria-hidden="true" size={22} />
      <button
        className={language === 'en' ? 'is-active' : ''}
        type="button"
        onClick={() => onChange('en')}
        data-testid="language-en"
      >
        English
      </button>
      <button
        className={language === 'ko' ? 'is-active' : ''}
        type="button"
        onClick={() => onChange('ko')}
        data-testid="language-ko"
      >
        한국어
      </button>
    </fieldset>
  );
}
