// shared/types.ts
export interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizResponse {
  questions: QuizQuestion[];
}

// JLPT N2 Question Types
export type N2Section = 'vocabulary' | 'grammar' | 'reading' | 'listening';

export interface N2Question {
  id: string;
  sub_id?: number;
  number?: number;
  section: N2Section;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard' | string;
}

export interface N2QuizState {
  questions: N2Question[];
  currentIndex: number;
  answers: { [key: number]: number };
  submitted: boolean;
  timeRemaining: number;
}

export const SECTION_LABELS: Record<N2Section, string> = {
  vocabulary: '文字・語彙',
  grammar: '文法',
  reading: '読解',
  listening: '聴解',
};

export const SECTION_TIME_LIMITS: Record<N2Section, number> = {
  vocabulary: 15 * 60,   // 15 minutes
  grammar: 20 * 60,      // 20 minutes
  reading: 55 * 60,      // 55 minutes
  listening: 40 * 60,    // 40 minutes
};