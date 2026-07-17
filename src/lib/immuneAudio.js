const SOUND_COOLDOWNS = {
  engulf: 90,
  shot: 70,
  signal: 110,
  division: 800,
  arrival: 600,
  cellAlert: 1200,
  cellRescue: 500,
  cellPop: 900,
  exhaust: 700,
  recharge: 450,
  rush: 300,
  net: 500,
  rally: 500,
  adaptive: 1800,
  warning: 1800,
  win: 2500,
  lose: 2500,
  toggle: 100,
  guide: 250,
  stageComplete: 500,
};

export function createImmuneSoundEngine() {
  let context = null;
  let master = null;
  let muted = false;
  let narration = null;
  const lastPlayed = new Map();

  const ensureContext = () => {
    if (typeof window === 'undefined') return null;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.14;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  };

  const tone = ({
    startFrequency,
    endFrequency = startFrequency,
    duration,
    volume,
    type = 'sine',
    delay = 0,
    attack = 0.008,
  }) => {
    const audio = ensureContext();
    if (!audio || !master) return;
    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, startFrequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(attack, duration * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  };

  const noise = ({ duration, volume, frequency, delay = 0 }) => {
    const audio = ensureContext();
    if (!audio || !master) return;
    const start = audio.currentTime + delay;
    const frameCount = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, frameCount, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(frequency, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.45), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  };

  const playPattern = (name) => {
    if (name === 'engulf') {
      tone({ startFrequency: 210, endFrequency: 76, duration: 0.2, volume: 0.34, type: 'sine' });
      tone({
        startFrequency: 360,
        endFrequency: 118,
        duration: 0.16,
        volume: 0.18,
        type: 'triangle',
        delay: 0.045,
      });
      noise({ duration: 0.11, volume: 0.09, frequency: 520 });
    } else if (name === 'shot') {
      tone({
        startFrequency: 760,
        endFrequency: 240,
        duration: 0.1,
        volume: 0.22,
        type: 'triangle',
      });
      noise({ duration: 0.055, volume: 0.07, frequency: 1800 });
    } else if (name === 'signal') {
      tone({ startFrequency: 540, endFrequency: 690, duration: 0.14, volume: 0.16, type: 'sine' });
      tone({
        startFrequency: 810,
        endFrequency: 930,
        duration: 0.15,
        volume: 0.11,
        type: 'sine',
        delay: 0.065,
      });
    } else if (name === 'division') {
      tone({ startFrequency: 190, endFrequency: 340, duration: 0.12, volume: 0.16, type: 'sine' });
      tone({
        startFrequency: 230,
        endFrequency: 410,
        duration: 0.13,
        volume: 0.12,
        type: 'sine',
        delay: 0.1,
      });
    } else if (name === 'arrival') {
      noise({ duration: 0.18, volume: 0.055, frequency: 1100 });
      tone({
        startFrequency: 370,
        endFrequency: 165,
        duration: 0.2,
        volume: 0.11,
        type: 'triangle',
      });
    } else if (name === 'cellAlert') {
      tone({
        startFrequency: 620,
        endFrequency: 470,
        duration: 0.13,
        volume: 0.14,
        type: 'square',
      });
      tone({
        startFrequency: 620,
        endFrequency: 430,
        duration: 0.16,
        volume: 0.12,
        type: 'square',
        delay: 0.18,
      });
    } else if (name === 'cellRescue') {
      [520, 660, 880].forEach((frequency, index) => {
        tone({
          startFrequency: frequency,
          endFrequency: frequency * 1.08,
          duration: 0.18,
          volume: 0.1,
          type: 'sine',
          delay: index * 0.055,
        });
      });
    } else if (name === 'cellPop') {
      noise({ duration: 0.16, volume: 0.075, frequency: 650 });
      tone({
        startFrequency: 230,
        endFrequency: 92,
        duration: 0.25,
        volume: 0.13,
        type: 'triangle',
      });
    } else if (name === 'exhaust') {
      tone({
        startFrequency: 290,
        endFrequency: 118,
        duration: 0.32,
        volume: 0.13,
        type: 'triangle',
      });
      noise({ duration: 0.18, volume: 0.045, frequency: 420, delay: 0.06 });
    } else if (name === 'recharge') {
      [360, 520, 720].forEach((frequency, index) => {
        tone({
          startFrequency: frequency,
          endFrequency: frequency * 1.12,
          duration: 0.2,
          volume: 0.09,
          type: 'sine',
          delay: index * 0.045,
        });
      });
    } else if (name === 'rush') {
      tone({
        startFrequency: 150,
        endFrequency: 410,
        duration: 0.32,
        volume: 0.22,
        type: 'triangle',
      });
      noise({ duration: 0.27, volume: 0.08, frequency: 900 });
      tone({
        startFrequency: 510,
        endFrequency: 720,
        duration: 0.2,
        volume: 0.13,
        type: 'sine',
        delay: 0.18,
      });
    } else if (name === 'net') {
      noise({ duration: 0.42, volume: 0.13, frequency: 2200 });
      tone({
        startFrequency: 410,
        endFrequency: 105,
        duration: 0.45,
        volume: 0.17,
        type: 'triangle',
      });
    } else if (name === 'rally') {
      [440, 554, 659].forEach((frequency, index) => {
        tone({
          startFrequency: frequency,
          endFrequency: frequency * 1.08,
          duration: 0.32,
          volume: 0.12,
          type: 'sine',
          delay: index * 0.055,
        });
      });
    } else if (name === 'adaptive') {
      [330, 440, 554, 659].forEach((frequency, index) => {
        tone({
          startFrequency: frequency,
          endFrequency: frequency * 1.18,
          duration: 0.46,
          volume: 0.13,
          type: 'sine',
          delay: index * 0.105,
        });
      });
    } else if (name === 'warning') {
      tone({
        startFrequency: 185,
        endFrequency: 160,
        duration: 0.16,
        volume: 0.18,
        type: 'triangle',
      });
      tone({
        startFrequency: 185,
        endFrequency: 150,
        duration: 0.2,
        volume: 0.15,
        type: 'triangle',
        delay: 0.2,
      });
    } else if (name === 'win') {
      [392, 494, 587, 784].forEach((frequency, index) => {
        tone({
          startFrequency: frequency,
          endFrequency: frequency * 1.04,
          duration: index === 3 ? 0.56 : 0.28,
          volume: index === 3 ? 0.17 : 0.13,
          type: 'sine',
          delay: index * 0.12,
        });
      });
    } else if (name === 'lose') {
      tone({
        startFrequency: 280,
        endFrequency: 120,
        duration: 0.66,
        volume: 0.18,
        type: 'triangle',
      });
      tone({
        startFrequency: 190,
        endFrequency: 82,
        duration: 0.7,
        volume: 0.12,
        type: 'sine',
        delay: 0.12,
      });
    } else if (name === 'toggle') {
      tone({ startFrequency: 620, endFrequency: 880, duration: 0.12, volume: 0.13, type: 'sine' });
    } else if (name === 'guide') {
      [523, 659, 784].forEach((frequency, index) => {
        tone({
          startFrequency: frequency,
          endFrequency: frequency * 1.06,
          duration: 0.22,
          volume: 0.1,
          type: 'sine',
          delay: index * 0.07,
        });
      });
    } else if (name === 'stageComplete') {
      [440, 554, 659, 880].forEach((frequency, index) => {
        tone({
          startFrequency: frequency,
          endFrequency: frequency * 1.08,
          duration: index === 3 ? 0.38 : 0.2,
          volume: index === 3 ? 0.14 : 0.1,
          type: 'sine',
          delay: index * 0.08,
        });
      });
    }
  };

  return {
    destroy() {
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
      if (context) void context.close();
      context = null;
      master = null;
      narration = null;
    },
    play(name) {
      if (muted) return;
      const now = Date.now();
      const cooldown = SOUND_COOLDOWNS[name] ?? 100;
      if (now - (lastPlayed.get(name) ?? 0) < cooldown) return;
      lastPlayed.set(name, now);
      playPattern(name);
    },
    setMuted(nextMuted) {
      muted = nextMuted;
      if (muted && typeof window !== 'undefined') window.speechSynthesis?.cancel();
      if (context && master) {
        master.gain.setTargetAtTime(muted ? 0 : 0.14, context.currentTime, 0.025);
      }
    },
    unlock() {
      ensureContext();
    },
    speak(text) {
      if (muted || typeof window === 'undefined') return false;
      const speech = window.speechSynthesis;
      const Utterance = window.SpeechSynthesisUtterance;
      if (!speech || !Utterance) {
        playPattern('guide');
        return false;
      }
      speech.cancel();
      narration = new Utterance(text);
      narration.rate = 0.9;
      narration.pitch = 1.18;
      narration.volume = 0.86;
      const voices = speech.getVoices();
      narration.voice =
        voices.find(
          (voice) =>
            voice.lang?.startsWith('en') &&
            /samantha|ava|google us english|serena/i.test(voice.name)
        ) ??
        voices.find((voice) => voice.lang?.startsWith('en')) ??
        null;
      narration.onend = () => {
        narration = null;
      };
      speech.speak(narration);
      return true;
    },
    stopNarration() {
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
      narration = null;
    },
  };
}
