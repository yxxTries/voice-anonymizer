/**
 * Background Service Worker
 * Manages extension state and relays settings to content scripts.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  pitchFactor: 1.08,
  formantShift: 1.18,
  noiseLevel: 0.0012,
  micGain: 1,
  tremoloRate: 0,
  tremoloDepth: 0,
  voiceStyle: 'balanced',
  previewVoiceStyle: 'balanced',
};

// Set defaults on first install and backfill missing keys on updates.
chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get('voiceAnonymizer', (result) => {
    const current = result.voiceAnonymizer || {};
    const merged = { ...DEFAULT_SETTINGS, ...current };
    const isInstall = details.reason === 'install';
    const hasMissingDefaults = Object.keys(DEFAULT_SETTINGS).some((key) => current[key] === undefined);

    if (isInstall || hasMissingDefaults) {
      chrome.storage.local.set({ voiceAnonymizer: merged });
    }

    if (isInstall) {
      console.log('[Voice Anonymizer] Installed with balanced clear defaults.');
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('voiceAnonymizer', (result) => {
      sendResponse(result.voiceAnonymizer || {});
    });
    return true;
  }
});