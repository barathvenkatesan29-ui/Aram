import type { SituationUnderstandingInput } from "../../types/situationUnderstanding";
import type { SituationUnderstandingProvider } from "./types.ts";

export const STUB_PROVIDER_ID = "stub";
export const STUB_MODEL_NAME = "stub-development";

const STUB_QUESTION_ID = "11111111-1111-4111-8111-111111111111";

export const stubProvider: SituationUnderstandingProvider = {
  id: STUB_PROVIDER_ID,
  modelName: STUB_MODEL_NAME,
  async understand(input: SituationUnderstandingInput): Promise<unknown> {
    const description = input.description.trim();
    const quote =
      description.length > 0
        ? description.slice(0, Math.min(80, description.length))
        : "";

    const userFacts =
      quote.length > 0
        ? [
            {
              text: "The user described a situation.",
              quote,
              source_kind: "description",
              source_question_id: null,
            },
          ]
        : [];

    if (input.round === "follow_up") {
      const answeredFacts = input.answers
        .filter((answer) => answer.status === "answered" && answer.answer.length > 0)
        .slice(0, 5)
        .map((answer) => ({
          text: "The user added this in a follow-up answer.",
          quote: answer.answer.slice(0, Math.min(80, answer.answer.length)),
          source_kind: "answer" as const,
          source_question_id: answer.id,
        }));

      return {
        userFacts: [...userFacts, ...answeredFacts],
        parties: [],
        inferences: [],
        assumptions: [],
        situationThemes: [{ text: "needs examination" }],
        missingInformation: [],
        uncertainties: [],
        questions: [],
      };
    }

    return {
      userFacts,
      parties: [],
      inferences: [],
      assumptions: [],
      situationThemes: [{ text: "needs examination" }],
      missingInformation: [],
      uncertainties: [],
      questions:
        description.length > 0
          ? [
              {
                id: STUB_QUESTION_ID,
                position: 1,
                question: "When did this happen?",
                why_it_matters: "A rough date can show what is still missing.",
              },
            ]
          : [],
    };
  },
};
