export async function transcribeAudioFile(
  audioUri: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  let context:
    | Awaited<ReturnType<typeof import("whisper.rn")["initWhisper"]>>
    | undefined;

  try {
    // Use the documented public entry point so Metro resolves the package's
    // React Native implementation and native module spec together.
    const { initWhisper } = await import("whisper.rn");

    context = await initWhisper({
      filePath: require("../../assets/ggml-base.bin"),
      // Keep the first compatibility test on CPU rather than optional GPU/NPU.
      useGpu: false,
    });

    const task = context.transcribe(audioUri, {
      language: "tr",
      maxThreads: 4,
      onProgress: (progress: number) => {
        onProgress?.(Math.max(0, Math.min(100, Math.round(progress))));
      },
    });

    const result = await task.promise;
    if (result.isAborted) {
      throw new Error("Transkripsiyon işlemi iptal edildi.");
    }
    return result.result;
  } catch (error: unknown) {
    const details =
      error instanceof Error
        ? error.message
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })();

    console.error("[Transcription] Ayrıntılı hata:", error);
    throw new Error(
      `Whisper başlatılamadı veya ses çözümlenemedi: ${details}. Native RNWhisper modülü bulunamazsa uygulamayı Expo Go yerine yeni oluşturulmuş Android APK'da çalıştırın.`,
    );
  } finally {
    if (context) {
      await context.release();
    }
  }
}
