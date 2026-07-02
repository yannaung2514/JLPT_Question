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