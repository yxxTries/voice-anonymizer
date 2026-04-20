/**
 * Popup Controller
 * Voice style dropdown, persistent on state, preview opens new tab.
 */

// ── DOM Elements ──
const enableToggle = document.getElementById('enableToggle');
const statusLabel = document.getElementById('statusLabel');
const voiceStyle = document.getElementById('voiceStyle');
const advancedPanel = document.getElementById('advancedPanel');
const pitchSlider = document.getElementById('pitchSlider');
const pitchValue = document.getElementById('pitchValue');
const formantSlider = document.getElementById('formantSlider');
const formantValue = document.getElementById('formantValue');
const noiseSlider = document.getElementById('noiseSlider');
const noiseValue = document.getElementById('noiseValue');
const tremoloRateSlider = document.getElementById('tremoloRateSlider');
const tremoloRateValue = document.getElementById('tremoloRateValue');
const tremoloDepthSlider = document.getElementById('tremoloDepthSlider');
const tremoloDepthValue = document.getElementById('tremoloDepthValue');
const previewBtn = document.getElementById('previewBtn');
const inputMeter = document.getElementById('inputMeter');
const outputMeter = document.getElementById('outputMeter');

// ── Voice Styles ──
const VOICES = {
  natural1: {
    pitch: 0.82,
    formant: 0.88,
    noise: 0.003,
    tremoloRate: 0,
    tremoloDepth: 0,
  },
  natural2: {
    pitch: 1.18,
    formant: 1.12,
    noise: 0.003,
    tremoloRate: 0,
    tremoloDepth: 0,
  },
  natural3: {
    pitch: 0.90,
    formant: 0.80,
    noise: 0.004,
    tremoloRate: 0.5,
    tremoloDepth: 0.02,
  },
  natural4: {
    pitch: 1.10,
    formant: 1.20,
    noise: 0.002,
    tremoloRate: 0,
    tremoloDepth: 0,
  },
};

// ── Gather current settings ──
function getSettings() {
  return {
    enabled: enableToggle.checked,
    pitchFactor: parseFloat(pitchSlider.value),
    formantShift: parseFloat(formantSlider.value),
    noiseLevel: parseFloat(noiseSlider.value),
    tremoloRate: parseFloat(tremoloRateSlider.value),
    tremoloDepth: parseFloat(tremoloDepthSlider.value),
    voiceStyle: voiceStyle.value,
  };
}

// ── Save & broadcast settings ──
function saveSettings() {
  const settings = getSettings();
  chrome.storage.local.set({ voiceAnonymizer: settings });

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'VOICE_ANON_SETTINGS',
        settings,
      }).catch(() => {});
    });
  });
}

// ── Update display values ──
function updateDisplayValues() {
  pitchValue.textContent = `${parseFloat(pitchSlider.value).toFixed(2)}x`;
  formantValue.textContent = `${parseFloat(formantSlider.value).toFixed(2)}x`;
  noiseValue.textContent = parseFloat(noiseSlider.value).toFixed(3);
  tremoloRateValue.textContent = `${parseFloat(tremoloRateSlider.value)} Hz`;
  tremoloDepthValue.textContent = `${Math.round(parseFloat(tremoloDepthSlider.value) * 100)}%`;
}

// ── Apply a voice style to sliders ──
function applyVoice(name) {
  const v = VOICES[name];
  if (!v) return;
  pitchSlider.value = v.pitch;
  formantSlider.value = v.formant;
  noiseSlider.value = v.noise;
  tremoloRateSlider.value = v.tremoloRate;
  tremoloDepthSlider.value = v.tremoloDepth;
  updateDisplayValues();
  saveSettings();
}

// ── Show/hide advanced panel ──
function toggleAdvanced() {
  if (voiceStyle.value === 'custom') {
    advancedPanel.classList.remove('hidden');
  } else {
    advancedPanel.classList.add('hidden');
  }
}

// ── Preview: open extension preview page in new tab ──
function startPreview() {
  saveSettings();
  chrome.tabs.create({
    url: chrome.runtime.getURL('preview.html'),
    active: true,
  });
}

// ── Event Listeners ──
enableToggle.addEventListener('change', () => {
  const on = enableToggle.checked;
  statusLabel.textContent = on ? 'ACTIVE' : 'OFF';
  statusLabel.className = `status ${on ? 'on' : 'off'}`;
  saveSettings();
});

voiceStyle.addEventListener('change', () => {
  toggleAdvanced();
  if (voiceStyle.value !== 'custom') {
    applyVoice(voiceStyle.value);
  }
});

[pitchSlider, formantSlider, noiseSlider, tremoloRateSlider, tremoloDepthSlider].forEach((slider) => {
  slider.addEventListener('input', () => {
    updateDisplayValues();
    saveSettings();
  });
});

previewBtn.addEventListener('click', startPreview);

// ── Initialize ──
chrome.storage.local.get('voiceAnonymizer', (result) => {
  if (result.voiceAnonymizer) {
    const s = result.voiceAnonymizer;
    enableToggle.checked = s.enabled !== false;
    pitchSlider.value = s.pitchFactor || 0.82;
    formantSlider.value = s.formantShift || 0.88;
    noiseSlider.value = s.noiseLevel || 0.003;
    tremoloRateSlider.value = s.tremoloRate || 0;
    tremoloDepthSlider.value = s.tremoloDepth || 0;
    voiceStyle.value = s.voiceStyle || 'natural1';

    const on = enableToggle.checked;
    statusLabel.textContent = on ? 'ACTIVE' : 'OFF';
    statusLabel.className = `status ${on ? 'on' : 'off'}`;
  }
  updateDisplayValues();
  toggleAdvanced();
});