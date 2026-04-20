/**
 * Background Service Worker
 * Manages extension state and relays settings to content scripts.
 */

// Set default settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    voiceAnonymizer: {
      enabled: true,
      pitchFactor: 1.08,
      formantShift: 1.18,
      noiseLevel: 0.0012,
      tremoloRate: 0,
      tremoloDepth: 0,
      voiceStyle: 'balanced',
      previewVoiceStyle: 'balanced',
    },
  });
  console.log('[Voice Anonymizer] Installed with balanced clear defaults.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('voiceAnonymizer', (result) => {
      sendResponse(result.voiceAnonymizer || {});
    });
    return true;
  }
});