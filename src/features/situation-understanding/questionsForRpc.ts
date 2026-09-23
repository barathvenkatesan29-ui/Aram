import type { FollowUpQuestion } from "../../types/situationUnderstanding.ts";

export type RpcQuestion = {
  position: number;
  question: string;
  why_it_matters: string;
};

export function questionsForRpc(questions: FollowUpQuestion[]): RpcQuestion[] {
  return questions.map((item) => ({
    position: item.position,
    question: item.question,
    why_it_matters: item.why_it_matters,
  }));
}
