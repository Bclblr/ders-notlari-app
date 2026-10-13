import * as FileSystem from "expo-file-system/legacy";

const SUPABASE_URL = "https://ynvosvngvuywizacyffn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inludm9zdm5ndnV5d2l6YWN5ZmZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MjY4NjgsImV4cCI6MjEwNzUwMjg2OH0.oYTu-WTtvJk1ISkFKYz19lE7JxUX_zd1ktFum_M74kc";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_sgCRvHAfxHisfeRI2ZXz0A_2jjAsnkS";

function getAudioMimeType(uri: string): string {
  const cleanUri = uri.split("?")[0].toLowerCase();
  if (cleanUri.endsWith(".wav")) return "audio/wav";
  if (cleanUri.endsWith(".mp3")) return "audio/mpeg";
  if (cleanUri.endsWith(".aac")) return "audio/aac";
  if (cleanUri.endsWith(".ogg")) return "audio/ogg";
  if (cleanUri.endsWith(".webm")) return "audio/webm";
  if (cleanUri.endsWith(".m4a") || cleanUri.endsWith(".mp4")) return "audio/mp4";
  return "audio/mp4";
}

export async function transcribeAudioFile(
  audioUri: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  onProgress?.(5);
  let audioBase64: string;
  try {
    audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    throw new Error("Ses dosyası cihazdan okunamadı.");
  }

  if (!audioBase64) throw new Error("Ses kaydı boş görünüyor.");
  if (audioBase64.length > 18_000_000) {
    throw new Error("Kayıt sunucu sınırından büyük. Daha kısa bir ses kaydı seç.");
  }

  onProgress?.(25);
  const response = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      audioBase64,
      mimeType: getAudioMimeType(audioUri),
    }),
  });

  let payload: { transcript?: string; error?: string };
  try {
    payload = await response.json();
  } catch {
    throw new Error("Sunucudan geçerli yanıt alınamadı.");
  }

  if (!response.ok) {
    throw new Error(payload.error || `Transkripsiyon isteği başarısız (HTTP ${response.status}).`);
  }
  if (typeof payload.transcript !== "string" || !payload.transcript.trim()) {
    throw new Error("Ses kaydından metin alınamadı.");
  }

  onProgress?.(100);
  return payload.transcript.trim();
}
