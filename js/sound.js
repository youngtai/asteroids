/* ============================================================
   SOUND (Web Audio API)
   ============================================================ */
let audioCtx = null;
let masterGain = null;

function initAudio() {
  try {
    if (!audioCtx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      audioCtx = new AudioCtor();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.85;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      const resume = audioCtx.resume();
      if (resume && typeof resume.catch === 'function') resume.catch(() => {});
    }
  } catch (e) {
    audioCtx = null;
    masterGain = null;
  }
}

function playSound(name) {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') initAudio();
    const out = masterGain || audioCtx.destination;
    const now = audioCtx.currentTime;
    switch (name) {
      case 'shoot': {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain).connect(out);
        osc.start(now); osc.stop(now + 0.1);
        break;
      }
      case 'hit': {
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.15);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++)
          data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        const source = audioCtx.createBufferSource();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, now);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        source.buffer = buffer;
        source.connect(filter).connect(gain).connect(out);
        source.start(now);
        break;
      }
      case 'explode': {
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.4);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++)
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 0.5);
        const source = audioCtx.createBufferSource();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.4);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        source.buffer = buffer;
        source.connect(filter).connect(gain).connect(out);
        source.start(now);
        break;
      }
      case 'pickup': {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.setValueAtTime(800, now + 0.05);
        osc.frequency.setValueAtTime(1000, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain).connect(out);
        osc.start(now); osc.stop(now + 0.2);
        break;
      }
      case 'ufoReveal': {
        const osc = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine'; osc2.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.3);
        osc2.frequency.setValueAtTime(150, now);
        osc2.frequency.exponentialRampToValueAtTime(450, now + 0.3);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain); osc2.connect(gain);
        gain.connect(out);
        osc.start(now); osc2.start(now);
        osc.stop(now + 0.4); osc2.stop(now + 0.4);
        break;
      }
      case 'shipHit': {
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.5);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++)
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 0.3);
        const source = audioCtx.createBufferSource();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(4000, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + 0.5);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        source.buffer = buffer;
        source.connect(filter).connect(gain).connect(out);
        source.start(now);
        break;
      }
      case 'missile': {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain).connect(out);
        osc.start(now); osc.stop(now + 0.18);
        break;
      }
    }
  } catch (e) { /* non-fatal */ }
}
