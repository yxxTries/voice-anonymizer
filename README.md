# Voice Anonymizer

Voice Anonymizer is a Chrome extension that anonymizes microphone audio in real time while keeping speech clear and understandable. It is designed for both human and AI conversations, so you can use your mic with voice-enabled assistants without exposing your raw vocal identity.

## Website and support

- Website: https://voice-anonymizer-website.vercel.app/
- Support email: yxx.tweaks@gmail.com
- Issue tracker: https://github.com/yxxTries/voice-anonymizer/issues

## Features

- Real-time microphone voice anonymization.
- AI-ready voice privacy for voice-enabled assistants and AI tools.
- Preset voice styles plus advanced custom controls.
- Mic input volume control.
- Built-in preview flow to record and compare results.
- Local settings persistence using Chrome storage.

## Privacy summary

- Audio processing runs locally in the browser.
- Microphone audio is not uploaded to developer servers.
- No account is required.
- The extension stores only user settings locally.

See full policy in [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

## Permissions

- `storage`: saves your selected anonymization settings.
- Site access where extension runs: required to process microphone streams in page context.

## Install for local testing

1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project folder.
5. Pin the extension from the Chrome toolbar.

## Usage

1. Open the extension popup.
2. Enable anonymization.
3. Choose a voice preset or use custom settings.
4. Adjust mic input volume if needed.
5. Use the preview tool to compare anonymized output.

## Public release docs

- Privacy policy: [PRIVACY_POLICY.md](PRIVACY_POLICY.md)
- Release checklist: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
- Chrome Web Store listing text: [CHROME_WEB_STORE_LISTING.md](CHROME_WEB_STORE_LISTING.md)
- Chrome Web Store privacy answers: [CWS_PRIVACY_ANSWERS.md](CWS_PRIVACY_ANSWERS.md)

## Repository structure

- [manifest.json](manifest.json): extension manifest and permissions.
- [popup.html](popup.html), [popup.css](popup.css), [popup.js](popup.js): popup UI and controls.
- [preview.html](preview.html), [preview.js](preview.js): preview recording and playback UI.
- [audio-processor.js](audio-processor.js): audio processing worklet.
- [content.js](content.js), [injected.js](injected.js): page-context interception pipeline.
- [background.js](background.js): initialization and defaults.

## Contributing

Issues and suggestions are welcome at:
https://github.com/yxxTries/voice-anonymizer/issues
