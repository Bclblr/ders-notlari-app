export async function transcribeAudioFile(
  audioUri: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  // Load the native Whisper module only when the user requests transcription.
  // This keeps the rest of the app's screens from initializing native Whisper
  // while being previewed in Expo Go.
  const { initWhisper } = await import("whisper.rn/index");
  const context = await initWhisper({
    filePath: require("../../assets/ggml-base.bin"),
    useGpu: true,
  });

  try {
    const task = context.transcribe(audioUri, {
      language: "tr",
      maxThreads: 4,
      onProgress: (progress: number) => {
        onProgress?.(Math.max(0, Math.min(100, Math.round(progress))));
      },
    });
    const result = await task.promise;
    if (result.isAborted) throw new Error("Transcription was cancelled.");
    return result.result;
  } finally {
    await context.release();
  }
}
