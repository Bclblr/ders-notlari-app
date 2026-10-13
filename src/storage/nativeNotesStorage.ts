import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";
import type { Note, NotesArchive } from "../types/note";
import type { AudioRecording } from "../types/recording";

const NOTES_STORAGE_KEY = "@ders-notlarim/notes-v1";
const RECORDINGS_STORAGE_KEY = "@ders-notlarim/recordings-v1";

/**
 * Stores notes only in this app's local device storage.
 * This adapter does not use a server, cloud account, or database.
 */
export async function loadNotes(): Promise<Note[]> {
  const raw = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
  if (!raw) return [];

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Yerel not arşivi beklenen biçimde değil.");
  }

  return parsed.filter(isNote);
}

export async function saveNotes(notes: Note[]): Promise<void> {
  await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
}

export async function loadRecordings(): Promise<AudioRecording[]> {
  const raw = await AsyncStorage.getItem(RECORDINGS_STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Ses kaydı arşivi beklenen biçimde değil.");
  return parsed.filter((item): item is AudioRecording => !!item && typeof item === "object" && typeof (item as AudioRecording).id === "string" && typeof (item as AudioRecording).uri === "string" && typeof (item as AudioRecording).title === "string" && typeof (item as AudioRecording).createdAt === "string");
}

export async function saveRecordings(recordings: AudioRecording[]): Promise<void> {
  await AsyncStorage.setItem(RECORDINGS_STORAGE_KEY, JSON.stringify(recordings));
}

export async function deleteRecordingFile(uri: string): Promise<void> {
  const file = new File(uri);
  if (file.exists) file.delete();
}

export async function exportNotesArchive(notes: Note[]): Promise<string> {
  const archive: NotesArchive = {
    schemaVersion: 1,
    notes,
    exportedAt: new Date().toISOString(),
  };

  return JSON.stringify(archive, null, 2);
}

export async function createNotesArchiveFile(notes: Note[]): Promise<string> {
  const json = await exportNotesArchive(notes);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = new File(Paths.cache, `ders-notlarim-yedek-${timestamp}.json`);
  file.create();
  file.write(json);
  return file.uri;
}

export async function importNotesArchive(json: string): Promise<Note[]> {
  const parsed: unknown = JSON.parse(json);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("schemaVersion" in parsed) ||
    parsed.schemaVersion !== 1 ||
    !("notes" in parsed) ||
    !Array.isArray(parsed.notes) ||
    !parsed.notes.every(isNote)
  ) {
    throw new Error("Dosya geçerli bir Ders Notlarım arşivi değil.");
  }

  return parsed.notes;
}

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.body === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}
