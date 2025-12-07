export interface Character {
  id: string;
  name: string;
  description: string;
  baseImage: string | null; // Base64 string of the reference image
}

export interface GeneratedScene {
  id: string;
  prompt: string;
  imageData: string; // Base64 string
  timestamp: number;
  videoUrl?: string; // Optional URL for the animated video
}

export enum GeneratorState {
  IDLE = 'IDLE',
  GENERATING_CHARACTER = 'GENERATING_CHARACTER',
  GENERATING_SCENE = 'GENERATING_SCENE',
  GENERATING_ANIMATION = 'GENERATING_ANIMATION',
  ERROR = 'ERROR',
}

export interface GenerationProgress {
  current: number;
  total: number;
  currentPrompt?: string;
}

export interface ApiError {
  message: string;
}