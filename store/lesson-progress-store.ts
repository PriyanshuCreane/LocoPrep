"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type ProgressRecord = {
  lessonId: string;
  courseId: string;
  lastWatchedTime: number;
  completed: boolean;
  xpEarned: number;
};

type LessonProgressState = {
  progressByLesson: Record<string, ProgressRecord>;
  setLocalProgress: (lessonId: string, courseId: string, lastWatchedTime: number, completed: boolean) => void;
  syncFromServer: (lessonId: string) => Promise<void>;
  saveToServer: (lessonId: string, courseId: string) => Promise<void>;
  removeLessonProgress: (lessonId: string) => void;
  resetAllProgress: () => void;
};

export const useLessonProgressStore = create<LessonProgressState>()(
  persist(
    (set, get) => ({
      progressByLesson: {},

      setLocalProgress: (lessonId, courseId, lastWatchedTime, completed) => {
        set((state) => ({
          progressByLesson: {
            ...state.progressByLesson,
            [lessonId]: {
              lessonId,
              courseId,
              lastWatchedTime,
              completed,
              xpEarned: state.progressByLesson[lessonId]?.xpEarned ?? 0,
            },
          },
        }));
      },

      syncFromServer: async (lessonId) => {
        const response = await fetch(`/api/progress?lessonId=${encodeURIComponent(lessonId)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as ProgressRecord;

        set((state) => ({
          progressByLesson: {
            ...state.progressByLesson,
            [lessonId]: data,
          },
        }));
      },

      saveToServer: async (lessonId, courseId) => {
        const current = get().progressByLesson[lessonId];

        if (!current) {
          return;
        }

        await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId,
            courseId,
            lastWatchedTime: current.lastWatchedTime,
            completed: current.completed,
          }),
        });
      },

      removeLessonProgress: (lessonId) => {
        set((state) => {
          const rest = { ...state.progressByLesson };
          delete rest[lessonId];
          return { progressByLesson: rest };
        });
      },

      resetAllProgress: () => {
        set({ progressByLesson: {} });
      },
    }),
    {
      name: "locoprep-lesson-progress",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ progressByLesson: state.progressByLesson }),
    },
  ),
);

