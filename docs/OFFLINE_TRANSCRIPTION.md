# Bundled offline transcription

## Goal

The app uses the multilingual Whisper Base model for Turkish speech recognition. The model is intended to be bundled into the iOS/Android application package so users do not download a separate model on first launch and transcription can work offline after installation.

## Build setup

- `whisper.rn` provides the native whisper.cpp bridge.
- `metro.config.js` allows Metro to bundle `.bin` model assets.
- `scripts/download-whisper-model.js` downloads the official `ggml-base.bin` model into `assets/`.
- EAS Build runs that script through the `eas-build-post-install` hook before the JavaScript bundle is produced.

The model binary is intentionally not committed to this repository because it is a large binary asset. The build script fetches it during build, not on the user's first launch.

## Local development

Run:

```sh
npm install
npm run download-whisper-model
npx expo prebuild
```

Then build a native development/release app. Expo Go cannot load this native module.

## Important status

This is build infrastructure only. The transcription UI/service still needs to be connected to recorded audio, and the native iOS/Android builds must be tested. Do not describe transcription as working until that integration and device testing are complete.

## Size and performance

The multilingual Base model is roughly 142 MB before app packaging. The final download/install size will be larger due to native libraries and packaging. Transcription speed and memory use depend on the device.
