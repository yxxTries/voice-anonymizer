let audioCtx, stream, source, worklet, inAn, outAn, animId;

document.getElementById('stopBtn').addEventListener('click', function () {
  if (animId) cancelAnimationFrame(animId);
  if (source) source.disconnect();
  if (worklet) worklet.disconnect();
  if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
  if (audioCtx) audioCtx.close();
  window.close();
});

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

function updateMeters() {
  if (inAn) {
    document.getElementById('inMeter').style.width =
      Math.min(100, getLevel(inAn) * 500) + '%';
  }
  if (outAn) {
    document.getElementById('outMeter').style.width =
      Math.min(100, getLevel(outAn) * 500) + '%';
  }
  animId = requestAnimationFrame(updateMeters);
}

async function start() {
  var statusBox = document.getElementById('statusBox');

  try {
    var result = await chrome.storage.local.get('voiceAnonymizer');
    var settings = result.voiceAnonymizer || {};

    statusBox.textContent = '🔄 Requesting microphone...';

    audioCtx = new AudioContext();
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    statusBox.textContent = '🔄 Loading audio processor...';

    var workletUrl = chrome.runtime.getURL('audio-processor.js');
    await audioCtx.audioWorklet.addModule(workletUrl);

    worklet = new AudioWorkletNode(audioCtx, 'voice-anonymizer');
    worklet.port.postMessage(settings);

    source = audioCtx.createMediaStreamSource(stream);
    inAn = audioCtx.createAnalyser();
    inAn.fftSize = 256;
    outAn = audioCtx.createAnalyser();
    outAn.fftSize = 256;

    source.connect(inAn);
    inAn.connect(worklet);
    worklet.connect(outAn);
    outAn.connect(audioCtx.destination);

    statusBox.textContent = '🎤 Listening — Speak now!';
    updateMeters();

    chrome.storage.onChanged.addListener(function (changes) {
      if (changes.voiceAnonymizer && worklet) {
        worklet.port.postMessage(changes.voiceAnonymizer.newValue);
      }
    });

  } catch (e) {
    statusBox.className = 'status error';
    statusBox.textContent = '❌ Error: ' + e.message;
    console.error('[Voice Anonymizer Preview]', e);
  }
}

start();