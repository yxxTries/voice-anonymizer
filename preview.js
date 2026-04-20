// ── State ──
let audioCtx = null;
let stream = null;
let sourceNode = null;
let inputAnalyser = null;
let animId = null;
let mediaRecorder = null;
let recordedChunks = [];
let originalBlob = null;
let disguisedBlob = null;
let timerInterval = null;
let recordStartTime = 0;
let currentlyPlaying = null;
let isProcessingDisguise = false;

// ── DOM ──
const statusBox = document.getElementById('statusBox');
const timerEl = document.getElementById('timer');
const inMeter = document.getElementById('inMeter');
const previewVoiceType = document.getElementById('previewVoiceType');
const voiceHint = document.getElementById('voiceHint');
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const playbackSection = document.getElementById('playbackSection');
const playOriginalBtn = document.getElementById('playOriginalBtn');
const playDisguisedBtn = document.getElementById('playDisguisedBtn');
const closeBtn = document.getElementById('closeBtn');

const VOICES = {
  balanced: {
    pitchFactor: 1.08,
    formantShift: 1.18,
    noiseLevel: 0.0012,
    tremoloRate: 0,
    tremoloDepth: 0,
    hint: 'Natural cadence with clear consonants and anonymized timbre.',
  },
  warm: {
    pitchFactor: 0.94,
    formantShift: 0.86,
    noiseLevel: 0.0014,
    tremoloRate: 0.4,
    tremoloDepth: 0.01,
    hint: 'Softer and fuller tone while preserving transcript quality.',
  },
  bright: {
    pitchFactor: 1.16,
    formantShift: 1.28,
    noiseLevel: 0.001,
    tremoloRate: 0,
    tremoloDepth: 0,
    hint: 'Crisp high-frequency emphasis for strong intelligibility.',
  },
  synthetic: {
    pitchFactor: 1.22,
    formantShift: 1.34,
    noiseLevel: 0.0018,
    tremoloRate: 0.8,
    tremoloDepth: 0.015,
    hint: 'Distinct from the original speaker with a neutral machine-like texture.',
  },
};

const DEFAULT_VOICE_STYLE = 'balanced';

function isKnownVoiceStyle(style) {
  return style === 'custom' || !!VOICES[style];
}

function getVoicePreset(style) {
  return VOICES[style] || VOICES[DEFAULT_VOICE_STYLE];
}

function updateVoiceHint() {
  if (previewVoiceType.value === 'custom') {
    voiceHint.textContent = 'Uses your custom slider values from the popup settings.';
    return;
  }
  voiceHint.textContent = getVoicePreset(previewVoiceType.value).hint;
}

async function getStoredSettings() {
  var result = await chrome.storage.local.get('voiceAnonymizer');
  return result.voiceAnonymizer || {};
}

async function getPreviewProcessingSettings() {
  var base = await getStoredSettings();
  var style = previewVoiceType.value;

  if (style === 'custom') {
    var fallback = getVoicePreset(DEFAULT_VOICE_STYLE);
    return {
      ...base,
      voiceStyle: 'custom',
      pitchFactor: base.pitchFactor != null ? base.pitchFactor : fallback.pitchFactor,
      formantShift: base.formantShift != null ? base.formantShift : fallback.formantShift,
      noiseLevel: base.noiseLevel != null ? base.noiseLevel : fallback.noiseLevel,
      tremoloRate: base.tremoloRate != null ? base.tremoloRate : fallback.tremoloRate,
      tremoloDepth: base.tremoloDepth != null ? base.tremoloDepth : fallback.tremoloDepth,
    };
  }

  return {
    ...base,
    ...getVoicePreset(style),
    voiceStyle: style,
  };
}

async function initializeVoicePicker() {
  var settings = await getStoredSettings();
  var styleFromPreview = settings.previewVoiceStyle;
  var styleFromPopup = settings.voiceStyle;
  var initialStyle = isKnownVoiceStyle(styleFromPreview)
    ? styleFromPreview
    : (isKnownVoiceStyle(styleFromPopup) ? styleFromPopup : DEFAULT_VOICE_STYLE);

  previewVoiceType.value = initialStyle;
  updateVoiceHint();
}

// ── Initialize mic ──
async function initMic() {
  try {
    audioCtx = new AudioContext();
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    sourceNode = audioCtx.createMediaStreamSource(stream);
    inputAnalyser = audioCtx.createAnalyser();
    inputAnalyser.fftSize = 256;
    sourceNode.connect(inputAnalyser);

    updateMeter();
    statusBox.textContent = 'Ready to record.';
    statusBox.className = 'status ready';
  } catch (e) {
    statusBox.className = 'status error';
    statusBox.textContent = 'Error: ' + e.message;
    recordBtn.disabled = true;
  }
}

// ── Meter ──
function getLevel(analyser) {
  var data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  var sum = 0;
  for (var i = 0; i < data.length; i++) {
    var v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

function updateMeter() {
  if (inputAnalyser) {
    inMeter.style.width = Math.min(100, getLevel(inputAnalyser) * 500) + '%';
  }
  animId = requestAnimationFrame(updateMeter);
}

// ── Timer ──
function startTimer() {
  recordStartTime = Date.now();
  timerEl.textContent = '0:00';
  timerInterval = setInterval(function () {
    var elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    timerEl.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
  }, 200);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ── Record ──
function startRecording() {
  recordedChunks = [];
  originalBlob = null;
  disguisedBlob = null;
  playbackSection.classList.remove('visible');

  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

  mediaRecorder.ondataavailable = function (e) {
    if (e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  mediaRecorder.onstop = async function () {
    originalBlob = new Blob(recordedChunks, { type: 'audio/webm' });
    statusBox.textContent = 'Processing anonymized version...';
    statusBox.className = 'status ready';

    try {
      var processingSettings = await getPreviewProcessingSettings();
      disguisedBlob = await createDisguisedVersion(originalBlob, processingSettings);
      statusBox.textContent = 'Recording is ready. Listen below.';
      statusBox.className = 'status done';
      playbackSection.classList.add('visible');
    } catch (e) {
      statusBox.textContent = 'Processing failed: ' + e.message;
      statusBox.className = 'status error';
      console.error(e);
    }

    recordBtn.disabled = false;
    recordBtn.textContent = 'Record Again';
    stopBtn.disabled = true;
  };

  mediaRecorder.start();
  startTimer();

  statusBox.textContent = 'Recording. Speak now.';
  statusBox.className = 'status recording';
  recordBtn.disabled = true;
  stopBtn.disabled = false;
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  stopTimer();
}

// ── Create disguised version offline ──
async function createDisguisedVersion(blob, settings) {
  var renderSettings = settings || (await getPreviewProcessingSettings());

  // Decode the original audio
  var arrayBuffer = await blob.arrayBuffer();
  var offlineCtx = new OfflineAudioContext(1, 1, 48000);
  var originalBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

  // Create offline context with correct length
  var sampleRate = originalBuffer.sampleRate;
  var length = originalBuffer.length;
  var offline = new OfflineAudioContext(1, length, sampleRate);

  // Load worklet
  var workletUrl = chrome.runtime.getURL('audio-processor.js');
  await offline.audioWorklet.addModule(workletUrl);

  var source = offline.createBufferSource();
  source.buffer = originalBuffer;

  var worklet = new AudioWorkletNode(offline, 'voice-anonymizer');
  worklet.port.postMessage(renderSettings);

  source.connect(worklet);
  worklet.connect(offline.destination);
  source.start(0);

  var renderedBuffer = await offline.startRendering();

  // Encode to wav blob
  var wavBlob = audioBufferToWav(renderedBuffer);
  return wavBlob;
}

// ── Convert AudioBuffer to WAV Blob ──
function audioBufferToWav(buffer) {
  var numChannels = buffer.numberOfChannels;
  var sampleRate = buffer.sampleRate;
  var format = 1; // PCM
  var bitDepth = 16;

  var bytesPerSample = bitDepth / 8;
  var blockAlign = numChannels * bytesPerSample;
  var dataLength = buffer.length * blockAlign;
  var headerLength = 44;
  var totalLength = headerLength + dataLength;

  var arrayBuffer = new ArrayBuffer(totalLength);
  var view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write samples
  var offset = 44;
  var channels = [];
  for (var ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  for (var i = 0; i < buffer.length; i++) {
    for (var ch = 0; ch < numChannels; ch++) {
      var sample = channels[ch][i];
      sample = Math.max(-1, Math.min(1, sample));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (var i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// ── Playback ──
function playBlob(blob, buttonEl) {
  // Stop any current playback
  stopPlayback();

  var url = URL.createObjectURL(blob);
  var audio = new Audio(url);
  currentlyPlaying = { audio: audio, url: url, button: buttonEl };

  buttonEl.classList.add('playing');

  audio.onended = function () {
    stopPlayback();
  };

  audio.play();
}

function stopPlayback() {
  if (currentlyPlaying) {
    currentlyPlaying.audio.pause();
    currentlyPlaying.audio.currentTime = 0;
    currentlyPlaying.button.classList.remove('playing');
    URL.revokeObjectURL(currentlyPlaying.url);
    currentlyPlaying = null;
  }
}

async function refreshDisguisedFromSelection() {
  if (!originalBlob || isProcessingDisguise) return;

  isProcessingDisguise = true;
  stopPlayback();
  statusBox.textContent = 'Applying selected preview voice...';
  statusBox.className = 'status ready';

  try {
    var processingSettings = await getPreviewProcessingSettings();
    disguisedBlob = await createDisguisedVersion(originalBlob, processingSettings);
    statusBox.textContent = 'Updated anonymized preview is ready.';
    statusBox.className = 'status done';
    playbackSection.classList.add('visible');
  } catch (e) {
    statusBox.textContent = 'Unable to update preview voice: ' + e.message;
    statusBox.className = 'status error';
    console.error(e);
  }

  isProcessingDisguise = false;
}

// ── Event Listeners ──
recordBtn.addEventListener('click', function () {
  stopPlayback();
  startRecording();
});

stopBtn.addEventListener('click', function () {
  stopRecording();
});

playOriginalBtn.addEventListener('click', function () {
  if (originalBlob) {
    playBlob(originalBlob, playOriginalBtn);
  }
});

playDisguisedBtn.addEventListener('click', function () {
  if (disguisedBlob) {
    playBlob(disguisedBlob, playDisguisedBtn);
  }
});

previewVoiceType.addEventListener('change', async function () {
  updateVoiceHint();
  var current = await getStoredSettings();
  current.previewVoiceStyle = previewVoiceType.value;
  chrome.storage.local.set({ voiceAnonymizer: current });
  refreshDisguisedFromSelection();
});

closeBtn.addEventListener('click', function () {
  stopPlayback();
  stopRecording();
  stopTimer();
  if (animId) cancelAnimationFrame(animId);
  if (sourceNode) sourceNode.disconnect();
  if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
  if (audioCtx) audioCtx.close();
  window.close();
});

// ── Start ──
async function initialize() {
  await initializeVoicePicker();
  await initMic();
}

initialize();