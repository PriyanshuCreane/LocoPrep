export interface Course {
  id: string;
  name: string;
  modules: Module[];
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
