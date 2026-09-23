export type ClarificationCardView = {
  questionId: string;
  question: string;
  whyItMatters: string;
  options: string[];
  status: "pending" | "answered" | "skipped";
  answer: string | null;
};

export type ClarificationCarouselView = {
  current: ClarificationCardView | null;
  previous: ClarificationCardView[];
  remainingAfterCurrent: number;
};
