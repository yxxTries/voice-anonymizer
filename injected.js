/**
 * Injected Script (runs in page's main world)
 * 
 * Overrides navigator.mediaDevices.getUserMedia to intercept audio streams
 * and route them through our voice anonymizer AudioWorklet.
 */

(function () {
  'use strict';

  // ── Read config from data attributes ──
  const currentScript = document.currentScript;
  const workletUrl = currentScript?.dataset?.workletUrl;
  let settings = {};
  try {
    settings = JSON.parse(currentScript?.dataset?.settings || '{}');
  } catch (e) {}

  // ── State ──
  let currentWorkletNode = null;

  // ── Listen for setting updates from content script ──
  window.addEventListener('__voiceAnon_settingsUpdate', (e) => {
    settings = e.detail || settings;
    if (currentWorkletNode) {
      currentWorkletNode.port.postMessage(settings);
    }
  });

  // ── Override getUserMedia ──
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
    navigator.mediaDevices
  );

  navigator.mediaDevices.getUserMedia = async function (constraints) {
    // Get the original stream
    const originalStream = await originalGetUserMedia(constraints);

    // Only process if audio is requested and anonymizer is enabled
    if (!constraints?.audio || settings.enabled === false) {
      return originalStream;
    }

    try {
      console.log('[Voice Anonymizer] Intercepting audio stream...');

      const audioCtx = new AudioContext();

      // Load the AudioWorklet processor
      if (workletUrl) {
        await audioCtx.audioWorklet.addModule(workletUrl);
      } else {
        // Fallback: inline the worklet as blob
        console.warn('[Voice Anonymizer] No worklet URL, using passthrough.');
        return originalStream;
      }

      // Create processing chain
      const source = audioCtx.createMediaStreamSource(originalStream);
      const worklet = new AudioWorkletNode(audioCtx, 'voice-anonymizer');
      const destination = audioCtx.createMediaStreamDestination();

      // Send current settings to worklet
      worklet.port.postMessage(settings);
      currentWorkletNode = worklet;

      // Connect: source → worklet → destination
      source.connect(worklet);
      worklet.connect(destination);

      // Build a new stream with anonymized audio + original video (if any)
      const anonymizedStream = new MediaStream();

      // Add anonymized audio tracks
      destination.stream.getAudioTracks().forEach((track) => {
        anonymizedStream.addTrack(track);
      });

      // Preserve original video tracks
      originalStream.getVideoTracks().forEach((track) => {
        anonymizedStream.addTrack(track);
      });

      // Clean up when tracks end
      anonymizedStream.getAudioTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          source.disconnect();
          worklet.disconnect();
          audioCtx.close();
          currentWorkletNode = null;
        });
      });

      console.log('[Voice Anonymizer] Audio stream anonymized successfully.');
      return anonymizedStream;
    } catch (err) {
      console.error('[Voice Anonymizer] Processing failed, returning original:', err);
      return originalStream;
    }
  };

  console.log('[Voice Anonymizer] getUserMedia interceptor installed.');
})();