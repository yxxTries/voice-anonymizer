/**
 * Voice Anonymizer AudioWorklet Processor
 * 
 * Uses a dual-tap pitch shifter with Hann crossfade,
 * formant-region filtering, tremolo modulation, and noise injection.
 * 
 * These combined effects mask vocal identity while preserving
 * speech intelligibility for AI speech recognition.
 */
class VoiceAnonymizerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // ── Default Parameters ──
    this.enabled = true;
    this.pitchFactor = 1.45;       // >1 = higher pitch, <1 = lower
    this.noiseLevel = 0.008;       // white noise amplitude
    this.tremoloRate = 5.0;        // Hz
    this.tremoloDepth = 0.15;      // 0–1
    this.formantShift = 1.2;       // formant region shift multiplier

    // ── Pitch Shifter State ──
    this.bufSize = 16384;
    this.buf = new Float32Array(this.bufSize);
    this.wp = 0;
    this.grainSize = 1024;
    this.minDelay = 64;

    // Two read-head offsets (delay from write position)
    this.offset1 = this.minDelay;
    this.offset2 = this.minDelay + this.grainSize / 2;

    // ── Tremolo State ──
    this.tremoloPhase = 0;

    // ── Formant Filter State (simple 2-pole resonator) ──
    this.filterState = { y1: 0, y2: 0, x1: 0, x2: 0 };

    // ── Message Handling ──
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.enabled !== undefined)      this.enabled = d.enabled;
      if (d.pitchFactor !== undefined)   this.pitchFactor = d.pitchFactor;
      if (d.noiseLevel !== undefined)    this.noiseLevel = d.noiseLevel;
      if (d.tremoloRate !== undefined)   this.tremoloRate = d.tremoloRate;
      if (d.tremoloDepth !== undefined)  this.tremoloDepth = d.tremoloDepth;
      if (d.formantShift !== undefined)  this.formantShift = d.formantShift;
      if (d.grainSize !== undefined) {
        this.grainSize = d.grainSize;
        this.offset2 = this.offset1 + this.grainSize / 2;
      }
    };
  }

  /**
   * Wrap index into buffer bounds
   */
  wrap(i) {
    return ((i % this.bufSize) + this.bufSize) % this.bufSize;
  }

  /**
   * Read from delay buffer with linear interpolation
   */
  readInterp(pos) {
    const i = Math.floor(pos);
    const f = pos - i;
    const a = this.buf[this.wrap(i)];
    const b = this.buf[this.wrap(i + 1)];
    return a + f * (b - a);
  }

  /**
   * Simple 2-pole bandpass resonator for formant coloring
   */
  applyFormantFilter(sample, centerFreq, q) {
    const w0 = (2 * Math.PI * centerFreq) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const b0 = alpha;
    const b1 = 0;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(w0);
    const a2 = 1 - alpha;

    const fs = this.filterState;
    const y = (b0 / a0) * sample
            + (b1 / a0) * fs.x1
            + (b2 / a0) * fs.x2
            - (a1 / a0) * fs.y1
            - (a2 / a0) * fs.y2;

    fs.x2 = fs.x1;
    fs.x1 = sample;
    fs.y2 = fs.y1;
    fs.y1 = y;

    return y;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];

    if (!input || !output) return true;

    // Bypass if disabled
    if (!this.enabled) {
      output.set(input);
      return true;
    }

    const speed = this.pitchFactor - 1.0;
    const maxDelay = this.minDelay + this.grainSize;

    for (let i = 0; i < input.length; i++) {
      // ── 1. Write input to circular delay buffer ──
      this.buf[this.wp] = input[i];

      // ── 2. Pitch Shifting (dual-tap with Hann crossfade) ──
      this.offset1 += speed;
      this.offset2 += speed;

      // Wrap offsets to keep read heads in valid range
      if (this.offset1 >= maxDelay) this.offset1 -= this.grainSize;
      if (this.offset1 < this.minDelay) this.offset1 += this.grainSize;
      if (this.offset2 >= maxDelay) this.offset2 -= this.grainSize;
      if (this.offset2 < this.minDelay) this.offset2 += this.grainSize;

      // Hann window weights based on position in grain
      const phase1 = (this.offset1 - this.minDelay) / this.grainSize;
      const phase2 = (this.offset2 - this.minDelay) / this.grainSize;
      const w1 = 0.5 * (1 - Math.cos(2 * Math.PI * phase1));
      const w2 = 0.5 * (1 - Math.cos(2 * Math.PI * phase2));

      // Read from both heads
      const s1 = this.readInterp(this.wp - this.offset1);
      const s2 = this.readInterp(this.wp - this.offset2);

      let sample = s1 * w1 + s2 * w2;

      // ── 3. Formant Coloring ──
      // Shift the formant center frequency to alter vocal timbre
      const formantCenter = 1800 * this.formantShift; // typical speech ~1800Hz
      const formantQ = 2.5;
      const formantSample = this.applyFormantFilter(sample, formantCenter, formantQ);
      // Mix: mostly original pitch-shifted + some formant color
      sample = sample * 0.7 + formantSample * 0.3;

      // ── 4. Tremolo (amplitude modulation) ──
      this.tremoloPhase += this.tremoloRate / sampleRate;
      if (this.tremoloPhase > 1) this.tremoloPhase -= 1;
      const tremoloGain = 1 - this.tremoloDepth * 0.5 * (1 - Math.cos(2 * Math.PI * this.tremoloPhase));
      sample *= tremoloGain;

      // ── 5. Noise Injection ──
      sample += (Math.random() * 2 - 1) * this.noiseLevel;

      // ── 6. Soft clipping to prevent distortion ──
      sample = Math.tanh(sample);

      output[i] = sample;

      // Advance write position
      this.wp = (this.wp + 1) % this.bufSize;
    }

    // Copy to other output channels
    for (let ch = 1; ch < outputs[0].length; ch++) {
      outputs[0][ch].set(output);
    }

    return true;
  }
}

registerProcessor('voice-anonymizer', VoiceAnonymizerProcessor);