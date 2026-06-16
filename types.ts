export interface Course {
  id: string;
  name: string;
  modules: Module[];
  sourceRootPath: string;
  sourceRootLabel: string;
}

export interface CourseFolder {
  id: string;
  label: string;
}

export interface CourseOrganizerState {
  folders: CourseFolder[];
  courseFolderMap: Record<string, string>;
}

export interface Module {
  id: string;
  name: string;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  contentPath: string;
  mediaType: "video" | "audio" | "text" | "pdf" | "quiz" | "document";
  fileExtension: string;
  duration?: number;
}
