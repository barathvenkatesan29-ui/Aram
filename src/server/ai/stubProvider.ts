import type { SituationUnderstandingInput } from "../../types/situationUnderstanding";
import type { SituationUnderstandingProvider } from "./types.ts";
import { organiseStubSituation } from "./organiseStubSituation.ts";

export const STUB_PROVIDER_ID = "stub";
export const STUB_MODEL_NAME = "stub-development";

export const stubProvider: SituationUnderstandingProvider = {
  id: STUB_PROVIDER_ID,
  modelName: STUB_MODEL_NAME,
  async understand(input: SituationUnderstandingInput): Promise<unknown> {
    return organiseStubSituation({
      description: input.description,
      answers: input.round === "follow_up" ? input.answers : [],
    });
  },
};
