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
const voiceDescription = document.getElementById('voiceDescription');
const previewBtn = document.getElementById('previewBtn');
const inputMeter = document.getElementById('inputMeter');
const outputMeter = document.getElementById('outputMeter');

// ── Voice Styles ──
const VOICES = {
  balanced: {
    pitch: 1.08,
    formant: 1.18,
    noise: 0.0012,
    tremoloRate: 0,
    tremoloDepth: 0,
    description: 'Natural cadence with clear consonants and anonymized timbre.',
  },
  warm: {
    pitch: 0.94,
    formant: 0.86,
    noise: 0.0014,
    tremoloRate: 0.4,
    tremoloDepth: 0.01,
    description: 'Softer and fuller tone while preserving transcript quality.',
  },
  bright: {
    pitch: 1.16,
    formant: 1.28,
    noise: 0.001,
    tremoloRate: 0,
    tremoloDepth: 0,
    description: 'Crisp high-frequency emphasis for strong intelligibility.',
  },
  synthetic: {
    pitch: 1.22,
    formant: 1.34,
    noise: 0.0018,
    tremoloRate: 0.8,
    tremoloDepth: 0.015,
    description: 'Distinct from the original speaker with a neutral machine-like texture.',
  },
};

const DEFAULT_VOICE_STYLE = 'balanced';

function getPreset(style) {
  return VOICES[style] || VOICES[DEFAULT_VOICE_STYLE];
}

function updateVoiceDescription() {
  if (!voiceDescription) return;
  if (voiceStyle.value === 'custom') {
    voiceDescription.textContent = 'Manual sliders let you tune your own anonymized profile.';
    return;
  }
  voiceDescription.textContent = getPreset(voiceStyle.value).description;
}

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
  const v = getPreset(name);
  if (!v) return;
  pitchSlider.value = v.pitch;
  formantSlider.value = v.formant;
  noiseSlider.value = v.noise;
  tremoloRateSlider.value = v.tremoloRate;
  tremoloDepthSlider.value = v.tremoloDepth;
  updateDisplayValues();
  updateVoiceDescription();
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
  updateVoiceDescription();
  if (voiceStyle.value !== 'custom') {
    applyVoice(voiceStyle.value);
  } else {
    saveSettings();
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
  const s = result.voiceAnonymizer || {};
  const savedStyle = s.voiceStyle;
  const isKnownStyle = savedStyle === 'custom' || !!VOICES[savedStyle];
  const resolvedStyle = isKnownStyle ? savedStyle : DEFAULT_VOICE_STYLE;
  const preset = getPreset(resolvedStyle);
  const canUseStoredParams = isKnownStyle;

  enableToggle.checked = s.enabled !== false;
  voiceStyle.value = resolvedStyle;

  pitchSlider.value = canUseStoredParams && s.pitchFactor != null ? s.pitchFactor : preset.pitch;
  formantSlider.value = canUseStoredParams && s.formantShift != null ? s.formantShift : preset.formant;
  noiseSlider.value = canUseStoredParams && s.noiseLevel != null ? s.noiseLevel : preset.noise;
  tremoloRateSlider.value = canUseStoredParams && s.tremoloRate != null ? s.tremoloRate : preset.tremoloRate;
  tremoloDepthSlider.value = canUseStoredParams && s.tremoloDepth != null ? s.tremoloDepth : preset.tremoloDepth;

  const on = enableToggle.checked;
  statusLabel.textContent = on ? 'ACTIVE' : 'OFF';
  statusLabel.className = `status ${on ? 'on' : 'off'}`;

  updateDisplayValues();
  toggleAdvanced();
  updateVoiceDescription();

  if (!result.voiceAnonymizer || !isKnownStyle) {
    applyVoice(resolvedStyle);
  }
});