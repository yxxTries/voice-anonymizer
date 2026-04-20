# Release Checklist

Use this checklist before publishing to the Chrome Web Store.

## Manifest and permissions

- Confirm the manifest contains only required permissions.
- Confirm all listed files exist in the repo.
- Confirm icon references point to the generated PNG files.
- Confirm no debug-only permissions remain.

## Privacy and disclosure

- Publish a privacy policy.
- State clearly that audio processing happens locally if that remains true.
- Explain any persistent storage used by the extension.
- Disclose microphone access in the store listing.

## Functional testing

- Test install, enable, disable, and reload flows.
- Test popup controls and preview playback.
- Test the extension on a fresh Chrome profile.
- Test the extension on a few real websites that use microphone input.
- Verify the extension icon appears correctly in Chrome.

## Store assets

- Provide a 128x128 extension icon.
- Capture at least 2 screenshots of the popup and preview UI.
- Write a short, accurate description of the extension.
- Prepare a support contact link.

## Final review

- Remove unused source files and development artifacts.
- Check for console errors and broken resource paths.
- Review the listing text for accuracy and clear privacy language.