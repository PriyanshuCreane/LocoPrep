"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type GamificationState = {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  nextLevelXp: number;
  setStats: (stats: {
    totalXp: number;
    currentStreak: number;
    longestStreak: number;
    level: number;
    nextLevelXp: number;
  }) => void;
  addXp: (amount: number) => void;
  syncStats: () => Promise<void>;
};

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set) => ({
      totalXp: 0,
      currentStreak: 0,
      longestStreak: 0,
      level: 1,
      nextLevelXp: 1000,

      setStats: (stats) => {
        set(stats);
      },

      addXp: (amount) => {
        set((state) => {
          const newTotalXp = state.totalXp + amount;
          const newLevel = Math.floor(newTotalXp / 1000) + 1;
          const nextXp = (newLevel * 1000) - newTotalXp;

          return {
            totalXp: newTotalXp,
            level: newLevel,
            nextLevelXp: Math.max(0, nextXp),
          };
        });
      },

      syncStats: async () => {
        try {
          const response = await fetch("/api/stats", { cache: "no-store" });
          if (response.ok) {
            const data = (await response.json()) as {
              totalXp: number;
              currentStreak: number;
              longestStreak: number;
              level: number;
              nextLevelXp: number;
            };
            set(data);
          }
        } catch {
          // Ignore sync errors
        }
      },
    }),
    {
      name: "locoprep-gamification",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        totalXp: state.totalXp,
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        level: state.level,
        nextLevelXp: state.nextLevelXp,
      }),
    },
  ),
);

