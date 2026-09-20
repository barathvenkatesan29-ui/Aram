import type { SituationUnderstandingInput } from "../../types/situationUnderstanding";

export type SituationUnderstandingProvider = {
  readonly id: string;
  readonly modelName: string;
  understand(input: SituationUnderstandingInput): Promise<unknown>;
};

export type ProviderResolution =
  | { ok: true; provider: SituationUnderstandingProvider }
  | { ok: false; failureCode: "unavailable" };
