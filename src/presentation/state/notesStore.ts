import { create } from 'zustand';
import type { EntityRef } from '../world/worldModel';

/**
 * Sticky notes on the team whiteboard. Local-first: stored in this browser
 * only (the UI says so). When the Forge backend exists, swap `storage` for an
 * API — the rest of the app does not change.
 */
export type NoteColor = 'yellow' | 'orange' | 'green' | 'blue';

export interface Note {
  id: string;
  text: string;
  color: NoteColor;
  /** Optional link to something in the data center (a change request, initiative, repository…). */
  ref: EntityRef | null;
  createdAt: string;
  /** Optional free position on the board, relative 0..1 (top-left of the note within the free area). Auto-grid when absent. */
  pos?: { x: number; y: number };
}

export const MAX_NOTES = 12;
export const MAX_NOTE_LENGTH = 140;
const KEY = 'voomp-forge.whiteboard.v1';

const storage = {
  read(): Note[] {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? (parsed as Note[]).slice(0, MAX_NOTES) : [];
    } catch {
      return [];
    }
  },
  write(notes: Note[]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(notes));
    } catch {
      /* storage unavailable (private mode): notes live for this session only */
    }
  },
};

interface NotesStore {
  notes: Note[];
  add: (text: string, color: NoteColor, ref: EntityRef | null) => void;
  update: (id: string, patch: Partial<Pick<Note, 'text' | 'color' | 'ref'>>) => void;
  remove: (id: string) => void;
  /** Moves a note on the board; coordinates are clamped to 0..1. */
  move: (id: string, pos: { x: number; y: number }) => void;
}

const newId = () => `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useNotesStore = create<NotesStore>((set, get) => {
  const commit = (notes: Note[]) => {
    storage.write(notes);
    set({ notes });
  };
  return {
    notes: typeof window === 'undefined' ? [] : storage.read(),
    add: (text, color, ref) => {
      const clean = text.trim().slice(0, MAX_NOTE_LENGTH);
      if (!clean || get().notes.length >= MAX_NOTES) return;
      commit([...get().notes, { id: newId(), text: clean, color, ref, createdAt: new Date().toISOString() }]);
    },
    update: (id, patch) =>
      commit(get().notes.map((n) => (n.id === id ? { ...n, ...patch, text: (patch.text ?? n.text).slice(0, MAX_NOTE_LENGTH) } : n))),
    remove: (id) => commit(get().notes.filter((n) => n.id !== id)),
    move: (id, pos) => {
      const clamp = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
      commit(get().notes.map((n) => (n.id === id ? { ...n, pos: { x: clamp(pos.x), y: clamp(pos.y) } } : n)));
    },
  };
});
