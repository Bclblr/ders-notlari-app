import type { Note, NotesArchive } from "../types/note";

/**
 * Local-only persistence adapter.
 *
 * This module deliberately has no network, cloud, server, or database calls.
 * It uses localStorage when available. On native iOS/Android, install and
 * wire an on-device storage adapter before enabling persistent saving.
 *
 * Until a native adapter is configured, functions return a clear error
 * instead of pretending notes have been saved.
 */

const STORAGE_KEY = "ders-notlarim.notes.v1";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function getBrowserStorage(): StorageLike | null {
  try {
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (
      candidate &&
      typeof candidate.getItem === "function" &&
      typeof candidate.setItem === "function"
    ) {
      return candidate;
    }
  } catch {
    // Access can throw in restricted browser contexts.
  }

  return null;
}

function isNote(value: unknown): value is Note {
  if (typeof value !== "object" || value === null) return false;
  const note = value as Partial<Note>;
  return (
    typeof note.id === "string" &&
    typeof note.title === "string" &&
    typeof note.body === "string" &&
    typeof note.createdAt === "string" &&
    typeof note.updatedAt === "string"
  );
}

function parseNotes(value: string): Note[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error("Yerel not arşivi beklenen biçimde değil.");
  }
  return parsed.filter(isNote);
}

export function isNativeStorageConfigured(): boolean {
  return getBrowserStorage() !== null;
}

export function loadNotes(): Note[] {
  const storage = getBrowserStorage();
  if (!storage) {
    throw new Error(
      "Bu cihaz için yerel kayıt adaptörü henüz kurulmadı. Notlar kalıcı kaydedilmiş sayılmaz."
    );
  }

  const raw = storage.getItem(STORAGE_KEY);
  return raw ? parseNotes(raw) : [];
}

export function saveNotes(notes: Note[]): void {
  const storage = getBrowserStorage();
  if (!storage) {
    throw new Error(
      "Bu cihaz için yerel kayıt adaptörü henüz kurulmadı. Kaydetme işlemi tamamlanmadı."
    );
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function exportNotesArchive(notes: Note[]): NotesArchive {
  return {
    schemaVersion: 1,
    notes,
    exportedAt: new Date().toISOString(),
  };
}

export function serializeNotesArchive(notes: Note[]): string {
  return JSON.stringify(exportNotesArchive(notes), null, 2);
}

export function parseNotesArchive(contents: string): Note[] {
  const parsed: unknown = JSON.parse(contents);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("schemaVersion" in parsed) ||
    !("notes" in parsed) ||
    (parsed as { schemaVersion?: unknown }).schemaVersion !== 1 ||
    !Array.isArray((parsed as { notes?: unknown }).notes)
  ) {
    throw new Error("Bu dosya desteklenen Ders Notlarım arşivi değil.");
  }

  return (parsed as { notes: unknown[] }).notes.filter(isNote);
}
