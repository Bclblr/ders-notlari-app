import { File, Paths } from "expo-file-system";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import type { Note } from "../types/note";
import type { AudioRecording } from "../types/recording";

type ArchiveManifest = {
  schemaVersion: 2;
  exportedAt: string;
  notes: Note[];
  recordings: Array<Omit<AudioRecording, "uri"> & { archivePath: string }>;
};

function validNote(value: unknown): value is Note {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.title === "string" &&
    typeof item.body === "string" && typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string";
}

function validRecording(value: unknown): value is AudioRecording {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.uri === "string" &&
    typeof item.title === "string" && typeof item.createdAt === "string";
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "recording";
}

export async function createFullArchiveFile(notes: Note[], recordings: AudioRecording[]): Promise<string> {
  const files: Record<string, Uint8Array> = {};
  const manifest: ArchiveManifest = {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    notes,
    recordings: [],
  };

  for (const recording of recordings) {
    const source = new File(recording.uri);
    if (!source.exists) {
      throw new Error(`Ses dosyası bulunamadı: ${recording.title}`);
    }
    const archivePath = `audio/${safeId(recording.id)}.m4a`;
    files[archivePath] = await source.bytes();
    manifest.recordings.push({
      id: recording.id,
      title: recording.title,
      createdAt: recording.createdAt,
      archivePath,
    });
  }

  files["manifest.json"] = strToU8(JSON.stringify(manifest));
  const bytes = zipSync(files, { level: 1 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = new File(Paths.cache, `ders-notlarim-tam-yedek-${stamp}.zip`);
  destination.create();
  destination.write(bytes);
  return destination.uri;
}

export async function restoreFullArchive(uri: string): Promise<{ notes: Note[]; recordings: AudioRecording[] }> {
  const source = new File(uri);
  const archive = unzipSync(await source.bytes());
  const manifestBytes = archive["manifest.json"];
  if (!manifestBytes) throw new Error("Yedek içinde manifest.json bulunamadı.");
  const parsed: unknown = JSON.parse(strFromU8(manifestBytes));
  if (!parsed || typeof parsed !== "object") throw new Error("Yedek biçimi geçersiz.");

  const data = parsed as Partial<ArchiveManifest>;
  if (data.schemaVersion !== 2 || !Array.isArray(data.notes) || !data.notes.every(validNote) ||
      !Array.isArray(data.recordings)) {
    throw new Error("Bu dosya geçerli bir Ders Notlarım tam yedeği değil.");
  }

  const restoredRecordings: AudioRecording[] = [];
  for (const item of data.recordings) {
    if (!item || typeof item !== "object" ||
        typeof item.id !== "string" || typeof item.title !== "string" ||
        typeof item.createdAt !== "string" || typeof item.archivePath !== "string" ||
        !item.archivePath.startsWith("audio/") || item.archivePath.includes("..")) {
      throw new Error("Yedekte geçersiz ses kaydı bilgisi var.");
    }
    const audioBytes = archive[item.archivePath];
    if (!audioBytes) throw new Error(`Yedekte ses dosyası eksik: ${item.title}`);
    const destination = new File(Paths.document, `ders-notlarim-${safeId(item.id)}.m4a`);
    destination.create();
    destination.write(audioBytes);
    restoredRecordings.push({
      id: item.id,
      title: item.title,
      createdAt: item.createdAt,
      uri: destination.uri,
    });
  }

  return { notes: data.notes, recordings: restoredRecordings };
}

export async function readLegacyNotesJson(json: string): Promise<Note[]> {
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") throw new Error("JSON yedeği geçersiz.");
  const data = parsed as { schemaVersion?: unknown; notes?: unknown };
  if (data.schemaVersion !== 1 || !Array.isArray(data.notes) || !data.notes.every(validNote)) {
    throw new Error("Bu dosya geçerli bir Ders Notlarım JSON yedeği değil.");
  }
  return data.notes;
}
