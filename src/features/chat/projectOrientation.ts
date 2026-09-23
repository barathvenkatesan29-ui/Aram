import type { SituationUnderstanding } from "../../types/situationUnderstanding";
import {
  formatOrientationBody,
  projectOrientationModel,
} from "./orientationModel.ts";

export function projectOrientation(
  understanding: SituationUnderstanding,
  description = "",
): string {
  const source =
    description.trim().length > 0
      ? description
      : understanding.userFacts
          .map((fact) => fact.quote)
          .filter((quote) => quote.trim().length > 0)
          .join(" ");

  return formatOrientationBody(
    projectOrientationModel({
      description: source,
      understanding,
    }),
  );
}
