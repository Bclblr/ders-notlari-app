export type NoteId = string;

export type Note = {
  id: NoteId;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateNoteInput = {
  title?: string;
  body?: string;
};

export type UpdateNoteInput = Partial<Pick<Note, "title" | "body">>;

export type NotesArchive = {
  schemaVersion: 1;
  notes: Note[];
  exportedAt: string;
};

export function createNote(input: CreateNoteInput = {}): Note {
  const now = new Date().toISOString();

  return {
    id: createNoteId(),
    title: input.title ?? "Yeni ders notu",
    body: input.body ?? "",
    createdAt: now,
    updatedAt: now,
  };
}

function createNoteId(): string {
  const cryptoObject = globalThis.crypto as Crypto | undefined;
  if (cryptoObject && typeof cryptoObject.randomUUID === "function") {
    return cryptoObject.randomUUID();
  }

  return "note-" + Date.now().toString(36) + "-" +
    Math.random().toString(36).slice(2, 10);
}
