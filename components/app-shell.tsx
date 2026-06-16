"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, Flame, Home, Moon, Settings, Star, Sun, UserCircle2 } from "lucide-react";
import { useGamificationStore } from "@/store/gamification-store";
import { useLessonProgressStore } from "@/store/lesson-progress-store";

type AppShellProps = {
  children: React.ReactNode;
};

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Progress", href: "/progress", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const totalXp = useGamificationStore((state) => state.totalXp);
  const currentStreak = useGamificationStore((state) => state.currentStreak);
  const syncStats = useGamificationStore((state) => state.syncStats);
  const setStats = useGamificationStore((state) => state.setStats);
  const resetAllProgress = useLessonProgressStore((state) => state.resetAllProgress);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const isAuthPage = useMemo(
    () => pathname === "/login" || pathname === "/signup" || pathname === "/reset-password",
    [pathname],
  );

  useEffect(() => {
    const initialTheme = (() => {
      if (typeof window === "undefined") {
        return "dark" as const;
      }

      const stored = window.localStorage.getItem("locoprep-theme");
      if (stored === "light" || stored === "dark") {
        return stored;
      }

      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    })();

    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("locoprep-theme", theme);
  }, [theme]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          setUserEmail(null);
          return;
        }

        const data = (await response.json()) as { user?: { email: string } | null };
        setUserEmail(data.user?.email ?? null);
      } catch {
        setUserEmail(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    void checkAuth();
  }, [pathname]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isAuthPage && !userEmail) {
      router.replace("/login");
      return;
    }

    if (isAuthPage && userEmail) {
      router.replace("/");
    }
  }, [isAuthLoading, isAuthPage, router, userEmail]);

  useEffect(() => {
    if (userEmail && !isAuthPage) {
      void syncStats();
    }
  }, [isAuthPage, syncStats, userEmail]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    resetAllProgress();
    setStats({
      totalXp: 0,
      currentStreak: 0,
      longestStreak: 0,
      level: 1,
      nextLevelXp: 1000,
    });
    setUserEmail(null);
    router.replace("/login");
  };

  if (isAuthPage) {
    return (
      <main className="relative min-h-screen px-4 py-10 sm:px-6">
        <button
          className="btn btn-ghost absolute right-4 top-4 h-10 w-10 px-0 sm:right-6"
          onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
          type="button"
          aria-label="Toggle theme"
          title="Toggle light/dark"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        {children}
      </main>
    );
  }

  if (isAuthLoading || !userEmail) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-luxe-soft edge-glow-violet w-full max-w-sm rounded-2xl p-5">
          <div className="skeleton skeleton-line w-1/3" />
          <div className="mt-3 skeleton skeleton-line w-full" />
          <div className="mt-2 skeleton skeleton-line w-5/6" />
        </div>
      </main>
    );
  }

  return (
    <div className="relative min-h-screen pb-28">
      <div className="mx-auto w-full max-w-[1680px] px-3 pt-3 sm:px-5 sm:pt-5 lg:px-7">
        <header className="glass-luxe edge-glow-violet flex items-center justify-between rounded-2xl px-4 py-3 sm:px-5">
          <Link
            href="/"
            className="group motion-hover-surface inline-flex items-center gap-3 rounded-full border border-transparent px-3 py-2 transition hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
            aria-label="Go to home page"
            title="Go to home page"
          >
            <span className="h-3 w-3 rounded-full bg-red-300/80 transition-transform duration-200 group-hover:scale-110" />
            <span className="h-3 w-3 rounded-full bg-amber-300/80 transition-transform duration-200 group-hover:scale-110" />
            <span className="h-3 w-3 rounded-full bg-emerald-300/80 transition-transform duration-200 group-hover:scale-110" />
            <p className="accent-script ml-1 text-sm font-semibold text-[var(--muted)] transition-colors duration-200 group-hover:text-[var(--foreground)]">
              LocoPrep
            </p>
          </Link>
          <div className="flex items-center gap-2">
            <div className="btn btn-secondary px-3 py-1.5 text-xs font-semibold">
              <Flame className="h-3.5 w-3.5" />
              {currentStreak}
            </div>
            <div className="btn btn-secondary px-3 py-1.5 text-xs font-semibold">
              <Star className="h-3.5 w-3.5" />
              {totalXp.toLocaleString()} XP
            </div>
            <div className="hidden rounded-lg border border-[color-mix(in_srgb,var(--foreground)_16%,transparent)] bg-[color-mix(in_srgb,var(--surface-2)_82%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] sm:inline-flex">
              {userEmail}
            </div>
          </div>
        </header>

        <main className="mt-4 min-h-[calc(100vh-11rem)] rounded-3xl border border-transparent bg-[color-mix(in_srgb,var(--surface)_75%,transparent)] p-3 shadow-[0_28px_60px_-42px_rgba(0,0,0,0.62)] backdrop-blur-sm sm:p-5">
          <div className="glass-luxe-soft edge-glow-violet paper-tape min-h-[calc(100vh-13rem)] rounded-2xl p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>

      <nav className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3 sm:bottom-5">
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-transparent bg-[color-mix(in_srgb,var(--surface-2)_84%,transparent)] px-2 py-2 shadow-[0_20px_45px_-28px_rgba(0,0,0,0.75)] backdrop-blur-xl sm:gap-2 sm:px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href) === true;

              return (
                <Link
                  key={item.label}
                  className={`group flex min-w-[3.1rem] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition sm:min-w-[4.25rem] sm:text-[11px] ${
                    isActive
                      ? "bg-[color-mix(in_srgb,var(--accent)_84%,#fff)] text-[#1f2320]"
                      : "text-[color-mix(in_srgb,var(--foreground)_82%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] hover:text-[var(--foreground)]"
                  }`}
                  href={item.href}
                  title={item.label}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <span className="mx-0.5 h-8 w-px bg-transparent sm:mx-1" />

            <button
              className="btn btn-ghost h-10 w-10 px-0"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              type="button"
              aria-label="Toggle theme"
              title="Toggle light/dark"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] text-[var(--foreground)]">
              <UserCircle2 className="h-5 w-5" />
            </div>

            <button
              className="btn btn-ghost h-10 px-3 py-0 text-xs"
              onClick={() => {
                void handleLogout();
              }}
              type="button"
              title="Logout"
            >
              Exit
            </button>
          </div>
      </nav>
    </div>
  );
}

