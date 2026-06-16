"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Pause, Play, SkipBack, SkipForward, CheckCircle2, Flame } from "lucide-react";
import type { Course, Lesson, Module } from "@/types";
import { useLessonProgressStore } from "@/store/lesson-progress-store";
import { useGamificationStore } from "@/store/gamification-store";

type LessonLocator = {
  course: Course;
  module: Module;
  lesson: Lesson;
  lessonIndex: number;
};

type PlaybackSettings = {
  autoplayVideos: boolean;
  autoAdvanceOnEnd: boolean;
  defaultPlaybackSpeed: number;
};

const BROWSER_PLAYABLE_VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".m4v"]);

function encodePath(contentPath: string): string {
  if (!contentPath) {
    return "";
  }

  return contentPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function findLesson(courses: Course[], courseSlug: string, lessonId: string): LessonLocator | null {
  const course = courses.find((item) => item.id === courseSlug);

  if (!course) {
    return null;
  }

  for (const moduleItem of course.modules) {
    const lessonIndex = moduleItem.lessons.findIndex((lesson) => lesson.id === lessonId);

    if (lessonIndex >= 0) {
      return {
        course,
        module: moduleItem,
        lesson: moduleItem.lessons[lessonIndex],
        lessonIndex,
      };
    }
  }

  return null;
}

export default function LessonViewerPage() {
  const params = useParams<{ courseSlug: string; lessonId: string }>();
  const router = useRouter();
  const courseSlug = params.courseSlug;
  const lessonId = params.lessonId;

  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");
  const [streakCount, setStreakCount] = useState(0);
  const [mediaPlaybackError, setMediaPlaybackError] = useState<string | null>(null);
  const [autoplayNotice, setAutoplayNotice] = useState<string | null>(null);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const [playbackSettings, setPlaybackSettings] = useState<PlaybackSettings>({
    autoplayVideos: false,
    autoAdvanceOnEnd: false,
    defaultPlaybackSpeed: 1,
  });

  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const autoplayAttemptedRef = useRef(false);
  const autoNextIntervalRef = useRef<number | null>(null);

  const progressByLesson = useLessonProgressStore((state) => state.progressByLesson);
  const setLocalProgress = useLessonProgressStore((state) => state.setLocalProgress);
  const syncFromServer = useLessonProgressStore((state) => state.syncFromServer);
  const saveToServer = useLessonProgressStore((state) => state.saveToServer);

  const addXp = useGamificationStore((state) => state.addXp);
  const syncStats = useGamificationStore((state) => state.syncStats);

  useEffect(() => {
    const loadCourses = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/courses", { cache: "no-store" });
        if (response.status === 401) {
          setError("Session expired. Redirecting to login...");
          window.location.href = "/login";
          return;
        }
        const data = (await response.json()) as Course[] | { error: string };

        if (!response.ok) {
          const message = "error" in data ? data.error : "Failed to load course data.";
          throw new Error(message);
        }

        setCourses(Array.isArray(data) ? data : []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load lesson.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadCourses();
  }, []);

  useEffect(() => {
    const loadPlaybackSettings = async () => {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (response.status === 401) {
          setError("Session expired. Redirecting to login...");
          window.location.href = "/login";
          return;
        }

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as Partial<PlaybackSettings>;
        const allowedSpeeds = new Set([0.5, 0.75, 1, 1.25, 1.5, 2]);
        const defaultPlaybackSpeed =
          typeof data.defaultPlaybackSpeed === "number" && allowedSpeeds.has(data.defaultPlaybackSpeed)
            ? data.defaultPlaybackSpeed
            : 1;
        setPlaybackSettings({
          autoplayVideos: Boolean(data.autoplayVideos),
          autoAdvanceOnEnd: Boolean(data.autoAdvanceOnEnd),
          defaultPlaybackSpeed,
        });
      } catch {
        // Ignore settings fetch failures and fall back to defaults.
      }
    };

    void loadPlaybackSettings();
  }, []);

  useEffect(() => {
    if (!lessonId) {
      return;
    }

    setMediaPlaybackError(null);
    setAutoplayNotice(null);
    setAutoNextCountdown(null);
    if (autoNextIntervalRef.current) {
      window.clearInterval(autoNextIntervalRef.current);
      autoNextIntervalRef.current = null;
    }
    autoplayAttemptedRef.current = false;
    void syncFromServer(lessonId);
  }, [lessonId, syncFromServer]);

  const located = useMemo(() => {
    if (!courseSlug || !lessonId) {
      return null;
    }

    return findLesson(courses, courseSlug, lessonId);
  }, [courses, courseSlug, lessonId]);

  const lessonProgress = progressByLesson[lessonId] ?? { lessonId: lessonId || "", courseId: "", lastWatchedTime: 0, completed: false, xpEarned: 0 };
  const watchedRatio = duration > 0 ? currentTime / duration : 0;
  const watchedPercent = Math.min(100, Math.round(watchedRatio * 100));
  const lessonExtension = located?.lesson.fileExtension.toLowerCase() ?? "";
  const isVideoLesson = located?.lesson.mediaType === "video";
  const isBrowserUnsupportedVideo = isVideoLesson && !BROWSER_PLAYABLE_VIDEO_EXTENSIONS.has(lessonExtension);
  const course = located?.course ?? null;
  const moduleItem = located?.module ?? null;
  const lessonIndex = located?.lessonIndex ?? -1;
  const courseId = course?.id ?? "";
  const previousLesson = moduleItem && lessonIndex > 0 ? moduleItem.lessons[lessonIndex - 1] : null;
  const nextLesson = moduleItem && lessonIndex < moduleItem.lessons.length - 1 ? moduleItem.lessons[lessonIndex + 1] : null;
  const canUseMediaPlayer = Boolean(
    located &&
      (located.lesson.mediaType === "audio" ||
        (located.lesson.mediaType === "video" && !isBrowserUnsupportedVideo)),
  );

  useEffect(() => {
    const media = mediaRef.current;

    if (!media) {
      return;
    }

    media.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    if (!lessonId) {
      return;
    }

    setSpeed(playbackSettings.defaultPlaybackSpeed || 1);
  }, [lessonId, playbackSettings.defaultPlaybackSpeed]);

  const clearAutoNextCountdown = () => {
    if (autoNextIntervalRef.current) {
      window.clearInterval(autoNextIntervalRef.current);
      autoNextIntervalRef.current = null;
    }
    setAutoNextCountdown(null);
  };

  useEffect(() => {
    const media = mediaRef.current;

    if (!media || !located || !canUseMediaPlayer) {
      return;
    }

    if (!playbackSettings.autoplayVideos || located.lesson.mediaType !== "video") {
      return;
    }

    if (autoplayAttemptedRef.current || !media.paused) {
      return;
    }

    autoplayAttemptedRef.current = true;
    const attemptAutoplay = async () => {
      const played = await safePlay(media, { autoplay: true });
      if (!played) {
        setAutoplayNotice("Autoplay was blocked by your browser. Press play to start.");
      }
    };

    const onCanPlay = () => {
      if (!media.paused) {
        return;
      }
      void attemptAutoplay();
    };

    void attemptAutoplay();
    media.addEventListener("canplay", onCanPlay, { once: true });

    return () => {
      media.removeEventListener("canplay", onCanPlay);
    };
  }, [canUseMediaPlayer, located, playbackSettings.autoplayVideos]);

  useEffect(() => {
    const media = mediaRef.current;

    if (!media) {
      return;
    }

    if (lessonProgress.lastWatchedTime > 0 && Math.abs(media.currentTime - lessonProgress.lastWatchedTime) > 2) {
      media.currentTime = lessonProgress.lastWatchedTime;
      setCurrentTime(lessonProgress.lastWatchedTime);
    }
  }, [lessonId, lessonProgress.lastWatchedTime]);

  useEffect(() => {
    if (!lessonId || !located || !canUseMediaPlayer) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const media = mediaRef.current;

      if (!media || media.paused) {
        return;
      }

      const shouldComplete = media.duration > 0 && media.currentTime / media.duration >= 0.9;

      setLocalProgress(lessonId, located.course.id, media.currentTime, shouldComplete || lessonProgress.completed);
      void saveToServer(lessonId, located.course.id);
    }, 10_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [canUseMediaPlayer, lessonId, located, lessonProgress.completed, saveToServer, setLocalProgress]);

  useEffect(() => {
    if (!lessonId || !canUseMediaPlayer) {
      return;
    }

    const media = mediaRef.current;

    if (!media) {
      return;
    }

    const onTimeUpdate = () => {
      setCurrentTime(media.currentTime);
      const shouldComplete = media.duration > 0 && media.currentTime / media.duration >= 0.9;
      if (located) {
        setLocalProgress(lessonId, located.course.id, media.currentTime, shouldComplete || lessonProgress.completed);
      }
    };

    const onLoadedMetadata = () => {
      setDuration(media.duration || 0);
      media.playbackRate = speed;
    };

    const onPlay = () => {
      setIsPlaying(true);
      setAutoplayNotice(null);
      clearAutoNextCountdown();
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = async () => {
      setIsPlaying(false);

      if (!located || located.lesson.mediaType !== "video") {
        return;
      }

      const shouldAdvance = playbackSettings.autoAdvanceOnEnd && nextLesson;
      if (!shouldAdvance) {
        return;
      }

      setLocalProgress(lessonId, located.course.id, media.duration || media.currentTime, true);
      await saveToServer(lessonId, located.course.id);

      let countdown = 5;
      clearAutoNextCountdown();
      setAutoNextCountdown(countdown);
      autoNextIntervalRef.current = window.setInterval(() => {
        countdown -= 1;

        if (countdown <= 0) {
          clearAutoNextCountdown();
          router.push(`/lesson/${courseId}/${nextLesson.id}`);
          return;
        }

        setAutoNextCountdown(countdown);
      }, 1000);
    };

    media.addEventListener("timeupdate", onTimeUpdate);
    media.addEventListener("loadedmetadata", onLoadedMetadata);
    media.addEventListener("play", onPlay);
    media.addEventListener("pause", onPause);
    media.addEventListener("ended", onEnded);

    return () => {
      media.removeEventListener("timeupdate", onTimeUpdate);
      media.removeEventListener("loadedmetadata", onLoadedMetadata);
      media.removeEventListener("play", onPlay);
      media.removeEventListener("pause", onPause);
      media.removeEventListener("ended", onEnded);
    };
  }, [canUseMediaPlayer, courseId, lessonId, located, lessonProgress.completed, nextLesson, playbackSettings.autoAdvanceOnEnd, router, saveToServer, setLocalProgress, speed]);

  useEffect(() => {
    return () => {
      if (autoNextIntervalRef.current) {
        window.clearInterval(autoNextIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!canUseMediaPlayer) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const media = mediaRef.current;
      if (!media) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      switch (event.key) {
        case " ":
          event.preventDefault();
          if (media.paused) {
            void safePlay(media);
          } else {
            media.pause();
          }
          break;
        case "ArrowLeft":
          event.preventDefault();
          media.currentTime = Math.max(0, media.currentTime - 10);
          break;
        case "ArrowRight":
          event.preventDefault();
          media.currentTime = Math.min(media.duration || 0, media.currentTime + 10);
          break;
        case "ArrowUp":
          event.preventDefault();
          media.volume = Math.min(1, media.volume + 0.1);
          break;
        case "ArrowDown":
          event.preventDefault();
          media.volume = Math.max(0, media.volume - 0.1);
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canUseMediaPlayer]);

  useEffect(() => {
    if (!lessonId) {
      return;
    }

    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const onVisibilityChange = () => {
      if (document.hidden && located) {
        void saveToServer(lessonId, located.course.id);
      }
    };

    const onBeforeUnload = () => {
      if (located) {
        void saveToServer(lessonId, located.course.id);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (located) {
        void saveToServer(lessonId, located.course.id);
      }
    };
  }, [lessonId, located, saveToServer]);

  const handleSeek = (value: number) => {
    const media = mediaRef.current;

    if (!media) {
      return;
    }

    media.currentTime = value;
    setCurrentTime(value);
  };

  const safePlay = async (
    media: HTMLMediaElement,
    options?: { autoplay?: boolean },
  ): Promise<boolean> => {
    try {
      await media.play();
      return true;
    } catch {
      if (options?.autoplay) {
        return false;
      }
      setMediaPlaybackError("This media could not be played in your browser. Open or download it to play in a desktop app.");
      return false;
    }
  };

  const togglePlay = async () => {
    const media = mediaRef.current;

    if (!media) {
      return;
    }

    if (media.paused) {
      await safePlay(media);
      return;
    }

    media.pause();
  };

  const markComplete = async () => {
    if (!lessonId || !located) {
      return;
    }

    // Mark as complete locally first
    setLocalProgress(lessonId, located.course.id, currentTime, true);
    await saveToServer(lessonId, located.course.id);

    try {
      // Call the completion API to award XP and update streak
      const response = await fetch("/api/lessons/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, courseId: located.course.id }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        xpEarned?: number;
        streak?: { currentStreak: number; longestStreak: number };
        error?: string;
      };

      if (data.success && data.xpEarned) {
        // Add XP to gamification store
        addXp(data.xpEarned);
        setStreakCount(data.streak?.currentStreak ?? 0);

        // Trigger confetti celebration only when browser APIs are available.
        try {
          if (typeof window !== "undefined" && typeof window.document !== "undefined") {
            const confettiModule = await import("canvas-confetti");
            const runConfetti = confettiModule.default;

            if (typeof runConfetti === "function") {
              const celebrate = runConfetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
              });

              if (celebrate && typeof celebrate.then === "function") {
                celebrate.catch(() => {
                  // Ignore confetti errors
                });
              }
            }
          }
        } catch {
          // Ignore confetti errors
        }

        // Show celebration message
        const streakText = data.streak?.currentStreak ? ` 🔥 ${data.streak.currentStreak}-day streak!` : "";
        setCelebrationMessage(`You earned ${data.xpEarned} XP!${streakText}`);
        setShowCelebration(true);

        // Hide celebration after 3 seconds
        setTimeout(() => setShowCelebration(false), 3000);

        // Re-sync gamification stats
        await syncStats();
      }
    } catch (err) {
      console.error("Error completing lesson:", err);
    }
  };

  const openFullscreen = async () => {
    const container = playerContainerRef.current;

    if (!container) {
      return;
    }

    if (typeof document === "undefined") {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await container.requestFullscreen();
  };

  if (isLoading) {
    return <section className="text-sm text-white/70">Loading lesson...</section>;
  }

  if (error) {
    return <section className="text-sm text-red-300">{error}</section>;
  }

  if (!located) {
    return <section className="text-sm text-white/70">Lesson not found.</section>;
  }

  const activeCourse = located.course;
  const activeModule = located.module;
  const activeLesson = located.lesson;

  const encodedPath = encodePath(activeLesson.contentPath);
  if (!encodedPath) {
    return <section className="text-sm text-red-300">Lesson content path is invalid.</section>;
  }

  const rootQuery = activeCourse.sourceRootPath ? `?root=${encodeURIComponent(activeCourse.sourceRootPath)}` : "";
  const agentUrl = typeof window !== "undefined" ? window.localStorage.getItem("locoprep-agent-url") || "" : "";
  const fileUrl = agentUrl ? `${agentUrl}/api/file?path=${encodedPath}` : `/api/files/${encodedPath}${rootQuery}`;
  const mediaUrl = activeLesson.mediaType === "video" 
    ? (agentUrl ? `${agentUrl}/api/file?path=${encodedPath}` : `/api/video/${encodedPath}${rootQuery}`) 
    : fileUrl;
  const lowerTitle = activeLesson.title.toLowerCase();
  const lowerContentPath = activeLesson.contentPath.toLowerCase();
  const isLikelyPdfByName = lowerContentPath.includes("pdf") || lowerTitle.includes("pdf");
  const isPdfLesson =
    activeLesson.mediaType === "pdf" || activeLesson.fileExtension.toLowerCase() === ".pdf" || isLikelyPdfByName;
  const openFileUrl = fileUrl;
  const canPreviewInline =
    !isPdfLesson && (activeLesson.mediaType !== "document") && !isBrowserUnsupportedVideo && !mediaPlaybackError;

  return (
    <section className="flex flex-col gap-6">
      {showCelebration && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="flex flex-col items-center gap-4 animate-bounce">
            <CheckCircle2 className="h-16 w-16 text-cyan-300" />
            <div className="text-center">
              <p className="text-2xl font-black text-[var(--foreground)]">{celebrationMessage}</p>
              {streakCount > 0 && (
                <div className="mt-3 flex items-center justify-center gap-2 text-lg font-semibold text-orange-200">
                  <Flame className="h-5 w-5" />
                  {streakCount} Day Streak!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="glass-luxe edge-glow-violet order-2 rounded-3xl p-6 space-y-2">
        <p className="accent-script text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          {activeCourse.name} / {activeModule.name}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">{activeLesson.title}</h1>
        <p className="max-w-3xl text-sm text-[color-mix(in_srgb,var(--foreground)_76%,transparent)]">
          Type: <span className="font-semibold uppercase">{activeLesson.mediaType}</span>.
          {canUseMediaPlayer
            ? " Use space/arrow keys for quick playback control."
            : " Read through the lesson and mark complete when done."}
          {mediaPlaybackError ? ` ${mediaPlaybackError}` : ""}
          {isBrowserUnsupportedVideo
            ? " This video format is not widely supported in browsers. Open or download it to play in a desktop video app."
            : ""}
        </p>
        {autoplayNotice ? <p className="text-xs text-[var(--muted)]">{autoplayNotice}</p> : null}
      </header>

      {canUseMediaPlayer && !mediaPlaybackError ? (
        <div ref={playerContainerRef} className="media-stage glass-luxe-soft edge-glow-violet order-1 overflow-hidden rounded-2xl">
          {activeLesson.mediaType === "video" ? (
            <video
              ref={(node) => {
                mediaRef.current = node;
                if (node) {
                  node.playbackRate = speed;
                }
              }}
              className="aspect-video w-full bg-[color-mix(in_srgb,var(--surface-2)_16%,#000)]"
              controls={false}
              preload="metadata"
              src={mediaUrl}
              onError={() => {
                setMediaPlaybackError("This media could not be played in your browser. Open or download it to play in a desktop app.");
              }}
            />
          ) : (
            <div className="p-8">
              <audio
                ref={(node) => {
                  mediaRef.current = node;
                  if (node) {
                    node.playbackRate = speed;
                  }
                }}
                className="w-full"
                controls={false}
                preload="metadata"
                src={mediaUrl}
                onError={() => {
                  setMediaPlaybackError("This media could not be played in your browser. Open or download it to play in a desktop app.");
                }}
              />
            </div>
          )}

          <div className="media-panel space-y-4 p-4 sm:p-5">
            <input
              className="media-range h-2 w-full cursor-pointer appearance-none rounded-full bg-[color-mix(in_srgb,var(--foreground)_16%,transparent)]"
              max={duration || 0}
              min={0}
              onChange={(event) => handleSeek(Number(event.target.value))}
              step={0.1}
              type="range"
              value={Math.min(currentTime, duration || 0)}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-secondary h-12 w-12"
                  onClick={() => handleSeek(Math.max(0, currentTime - 10))}
                  type="button"
                >
                  <SkipBack className="h-5 w-5" />
                </button>
                <button
                  className="btn btn-primary h-12 w-12"
                  onClick={() => {
                    void togglePlay();
                  }}
                  type="button"
                >
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </button>
                <button
                  className="btn btn-secondary h-12 w-12"
                  onClick={() => handleSeek(Math.min(duration, currentTime + 10))}
                  type="button"
                >
                  <SkipForward className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label className="media-label text-sm font-medium">
                  Speed
                  <select
                    className="media-select ml-2 rounded-lg px-2 py-1 text-sm"
                    onChange={(event) => setSpeed(Number(event.target.value))}
                    value={speed}
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </label>
                <button
                  className="btn btn-secondary h-12 w-12"
                  onClick={() => {
                    void openFullscreen();
                  }}
                  type="button"
                >
                  <Maximize2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="media-label text-sm">
                Watched: <span className="font-semibold text-[var(--foreground)]">{watchedPercent}%</span>
              </p>
              <button
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  lessonProgress.completed
                    ? "media-action-complete cursor-default"
                    : "media-action-primary"
                }`}
                onClick={markComplete}
                type="button"
                disabled={lessonProgress.completed}
              >
                {lessonProgress.completed ? "✓ Completed" : "Mark Complete"}
              </button>
            </div>

            {autoNextCountdown !== null ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/16 bg-[color-mix(in_srgb,var(--surface)_86%,transparent)] px-3 py-2">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Auto next in {autoNextCountdown}...
                </p>
                <button
                  className="btn btn-ghost px-3 py-1 text-xs"
                  onClick={clearAutoNextCountdown}
                  type="button"
                >
                  Cancel auto-next
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="glass-luxe-soft edge-glow-violet order-1 rounded-2xl p-5">
          {!canPreviewInline ? (
            <div className="glass-luxe-soft edge-glow-violet rounded-xl p-5">
              <p className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_78%,transparent)]">
                {isPdfLesson
                  ? "PDF preview is unavailable in this app. Please open the file directly from File Explorer."
                  : `This file type (${activeLesson.fileExtension}) cannot be reliably previewed inline in all browsers.`}
              </p>
              <p className="mt-2 text-xs text-[color:color-mix(in_srgb,var(--foreground)_62%,transparent)]">
                {isPdfLesson
                  ? `File path: ${activeCourse.sourceRootPath}/${activeLesson.contentPath}`
                  : "Use open or download to view it in your preferred app."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {mediaPlaybackError && (
                  <button
                    className="btn btn-secondary px-4 py-2 text-sm font-semibold"
                    onClick={() => {
                      setMediaPlaybackError(null);
                    }}
                    type="button"
                  >
                    Try inline again
                  </button>
                )}
                {!isPdfLesson && (
                  <a
                    className="btn btn-ghost px-4 py-2 text-sm font-semibold"
                    href={openFileUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open file
                  </a>
                )}
                <a
                  className="btn btn-primary px-4 py-2 text-sm font-bold"
                  download
                  href={fileUrl}
                >
                  Download
                </a>
              </div>
            </div>
          ) : (
            <>
              <iframe
                className="h-[70vh] w-full rounded-xl border border-[color-mix(in_srgb,var(--foreground)_18%,transparent)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)]"
                src={fileUrl}
                title={activeLesson.title}
              />
            </>
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]">
              {isPdfLesson
                ? "For PDFs, open the file directly from File Explorer using the path above."
                : "Open in new tab if embedded view is restricted by browser."}
            </p>
            {!isPdfLesson && (
              <a
                className="btn btn-ghost px-4 py-2 text-sm font-semibold"
                href={openFileUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open file
              </a>
            )}
          </div>
          <div className="mt-4">
            <button
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                lessonProgress.completed
                  ? "media-action-complete cursor-default"
                  : "media-action-primary"
              }`}
              onClick={markComplete}
              type="button"
              disabled={lessonProgress.completed}
            >
              {lessonProgress.completed ? "✓ Completed" : "Mark Complete"}
            </button>
          </div>
        </div>
      )}

      <div className="glass-luxe-soft edge-glow-violet order-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        {previousLesson ? (
          <Link
            className="btn btn-ghost px-4 py-2 text-sm font-semibold"
            href={`/lesson/${activeCourse.id}/${previousLesson.id}`}
          >
            Previous lesson
          </Link>
        ) : (
          <span className="text-sm text-[color-mix(in_srgb,var(--foreground)_38%,transparent)]">No previous lesson</span>
        )}

        {nextLesson ? (
          <Link
            className="media-action-next rounded-full px-4 py-2 text-sm font-bold"
            href={`/lesson/${activeCourse.id}/${nextLesson.id}`}
          >
            Next lesson
          </Link>
        ) : (
          <span className="text-sm text-[color-mix(in_srgb,var(--foreground)_38%,transparent)]">No next lesson</span>
        )}
      </div>
    </section>
  );
}
