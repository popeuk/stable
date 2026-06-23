"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ActionStatus = "engaged" | "done" | "dropped";

/** An action the user committed to — the co-pilot remembers and follows up. */
export interface CommittedAction {
  id: string;
  recoId: string;
  type: string;
  title: string;
  expectedImpact: number;
  relatedHorseId?: string;
  costPost?: string;
  periodKey: string; // when engaged
  createdAt: number;
  status: ActionStatus;
  doneAt?: number;
}

export interface CommitInput {
  recoId: string;
  type: string;
  title: string;
  expectedImpact: number;
  relatedHorseId?: string;
  costPost?: string;
  periodKey: string;
}

interface CoachState {
  actions: CommittedAction[];
  /** Lesson keys the user has opened — feeds the mastery path. */
  seenLessons: string[];
  commit: (input: CommitInput) => void;
  complete: (id: string) => void;
  drop: (id: string) => void;
  reopen: (id: string) => void;
  markLessonSeen: (key: string) => void;
  isCommitted: (recoId: string) => boolean;
}

let n = 0;
const id = () => `act-${Date.now().toString(36)}-${(n++).toString(36)}`;

export const useCoachStore = create<CoachState>()(
  persist(
    (set, get) => ({
      actions: [],
      seenLessons: [],

      commit: (input) =>
        set((s) => {
          // Don't double-commit the same live recommendation.
          if (s.actions.some((a) => a.recoId === input.recoId && a.status === "engaged")) {
            return s;
          }
          const action: CommittedAction = {
            ...input,
            id: id(),
            createdAt: Date.now(),
            status: "engaged",
          };
          return { actions: [action, ...s.actions] };
        }),

      complete: (actionId) =>
        set((s) => ({
          actions: s.actions.map((a) =>
            a.id === actionId ? { ...a, status: "done", doneAt: Date.now() } : a,
          ),
        })),

      drop: (actionId) =>
        set((s) => ({
          actions: s.actions.map((a) => (a.id === actionId ? { ...a, status: "dropped" } : a)),
        })),

      reopen: (actionId) =>
        set((s) => ({
          actions: s.actions.map((a) =>
            a.id === actionId ? { ...a, status: "engaged", doneAt: undefined } : a,
          ),
        })),

      markLessonSeen: (key) =>
        set((s) => (s.seenLessons.includes(key) ? s : { seenLessons: [...s.seenLessons, key] })),

      isCommitted: (recoId) =>
        get().actions.some((a) => a.recoId === recoId && a.status === "engaged"),
    }),
    { name: "be-stable-coach", version: 1 },
  ),
);
