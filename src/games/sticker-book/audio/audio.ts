import type { Language, Scenario, VocabularyEntry } from '../types/game';

export type SfxName = 'pickup' | 'placed' | 'return' | 'sticker' | 'language';

export interface AudioEngine {
  prepareForInteraction(): void;
  playVocabulary(entry: VocabularyEntry, language: Language): Promise<void>;
  playSfx(name: SfxName): Promise<void>;
  setMusicForScenario(scenario: Scenario): Promise<void>;
}

class BrowserAudioEngine implements AudioEngine {
  private audioContext: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private sfxOscillator: OscillatorNode | null = null;

  prepareForInteraction(): void {
    this.ensureSfxVoice();
  }

  async playVocabulary(entry: VocabularyEntry, language: Language): Promise<void> {
    const spokenText = language === 'en' ? entry.english : entry.korean;
    const spokenLang = language === 'en' ? 'en-US' : 'ko-KR';

    if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = spokenLang;
      utterance.rate = 0.88;
      utterance.pitch = 1.04;
      window.speechSynthesis.speak(utterance);
      return;
    }

    await this.playTone(520, 0.08);
  }

  async playSfx(name: SfxName): Promise<void> {
    const frequencyByName: Record<SfxName, number> = {
      pickup: 420,
      placed: 620,
      return: 230,
      sticker: 760,
      language: 540,
    };

    await this.playTone(frequencyByName[name], 0.06);
  }

  async setMusicForScenario(_scenario: Scenario): Promise<void> {
    return Promise.resolve();
  }

  private async playTone(frequency: number, durationSeconds: number): Promise<void> {
    try {
      const context = this.ensureSfxVoice();

      if (!context || !this.sfxGain || !this.sfxOscillator) {
        return;
      }

      if (context.state === 'suspended') {
        await context.resume();
      }

      const startTime = context.currentTime + 0.005;
      this.sfxOscillator.frequency.cancelScheduledValues(startTime);
      this.sfxOscillator.frequency.setValueAtTime(frequency, startTime);
      this.sfxGain.gain.cancelScheduledValues(startTime);
      this.sfxGain.gain.setValueAtTime(0, startTime);
      this.sfxGain.gain.linearRampToValueAtTime(0.09, startTime + 0.012);
      this.sfxGain.gain.linearRampToValueAtTime(0, startTime + durationSeconds);
    } catch {
      return;
    }
  }

  private ensureSfxVoice(): AudioContext | null {
    const context = this.getAudioContext();

    if (!context) {
      return null;
    }

    if (!this.sfxGain || !this.sfxOscillator) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.frequency.value = 420;
      oscillator.type = 'triangle';
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();

      this.sfxOscillator = oscillator;
      this.sfxGain = gain;
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    return context;
  }

  private getAudioContext(): AudioContext | null {
    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;

    if (!AudioContextConstructor) {
      return null;
    }

    this.audioContext ??= new AudioContextConstructor();
    return this.audioContext;
  }
}

export const audioEngine: AudioEngine = new BrowserAudioEngine();
