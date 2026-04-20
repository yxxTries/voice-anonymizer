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

// ── DOM ──
const statusBox = document.getElementById('statusBox');
const timerEl = document.getElementById('timer');
const inMeter = document.getElementById('inMeter');
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const playbackSection = document.getElementById('playbackSection');
const playOriginalBtn = document.getElementById('playOriginalBtn');
const playDisguisedBtn = document.getElementById('playDisguisedBtn');
const closeBtn = document.getElementById('closeBtn');

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
    statusBox.textContent = '🎤 Ready to record';
    statusBox.className = 'status ready';
  } catch (e) {
    statusBox.className = 'status error';
    statusBox.textContent = '❌ ' + e.message;
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
    statusBox.textContent = '🔄 Processing disguised version...';
    statusBox.className = 'status ready';

    try {
      disguisedBlob = await createDisguisedVersion(originalBlob);
      statusBox.textContent = '✅ Recording ready — listen below!';
      statusBox.className = 'status done';
      playbackSection.classList.add('visible');
    } catch (e) {
      statusBox.textContent = '❌ Processing failed: ' + e.message;
      statusBox.className = 'status error';
      console.error(e);
    }

    recordBtn.disabled = false;
    recordBtn.textContent = '⏺ Record Again';
    stopBtn.disabled = true;
  };

  mediaRecorder.start();
  startTimer();

  statusBox.textContent = '🔴 Recording... speak now!';
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
async function createDisguisedVersion(blob) {
  var result = await chrome.storage.local.get('voiceAnonymizer');
  var settings = result.voiceAnonymizer || {};

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
  worklet.port.postMessage(settings);

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
initMic();