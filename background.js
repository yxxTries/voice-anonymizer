/**
 * Background Service Worker
 * Manages extension state and relays settings to content scripts.
 */

// Set default settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    voiceAnonymizer: {
      enabled: true,
      pitchFactor: 0.82,
      formantShift: 0.88,
      noiseLevel: 0.003,
      tremoloRate: 0,
      tremoloDepth: 0,
      voiceStyle: 'natural1',
    },
  });
  console.log('[Voice Anonymizer] Installed with natural voice defaults.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('voiceAnonymizer', (result) => {
      sendResponse(result.voiceAnonymizer || {});
    });
    return true;
  }
});