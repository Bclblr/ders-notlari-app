const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
const ASSET_DIR = path.join(__dirname, "..", "assets");
const MODEL_PATH = path.join(ASSET_DIR, "ggml-base.bin");
const MIN_MODEL_BYTES = 100 * 1024 * 1024;

async function main() {
  fs.mkdirSync(ASSET_DIR, { recursive: true });

  if (fs.existsSync(MODEL_PATH)) {
    const existingSize = fs.statSync(MODEL_PATH).size;
    if (existingSize >= MIN_MODEL_BYTES) {
      console.log(`Whisper Base model already present (${existingSize} bytes).`);
      return;
    }
    fs.unlinkSync(MODEL_PATH);
  }

  console.log("Downloading multilingual Whisper Base model for app bundling...");
  console.log("This happens during development/build setup, not on the user's first launch.");

  const response = await fetch(MODEL_URL, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Model download failed: HTTP ${response.status}`);
  }

  const tempPath = MODEL_PATH + ".download";
  try {
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(tempPath));
    const size = fs.statSync(tempPath).size;
    if (size < MIN_MODEL_BYTES) {
      throw new Error(`Downloaded model is unexpectedly small (${size} bytes); refusing to use it.`);
    }
    fs.renameSync(tempPath, MODEL_PATH);
    console.log(`Whisper Base model ready: ${MODEL_PATH} (${size} bytes).`);
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
