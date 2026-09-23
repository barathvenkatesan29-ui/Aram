export const INTELLIGENCE_READINESS_MIN_LENGTH = 50;
export const MAX_SITUATION_NARRATIVE_LENGTH = 8000;
export const PRE_UNDERSTANDING_NARRATIVE_SEPARATOR = "\n\n";

export function buildProvisionalNarrative(messageBodies: string[]): string {
  return messageBodies
    .map((body) => body.trim())
    .filter((body) => body.length > 0)
    .join(PRE_UNDERSTANDING_NARRATIVE_SEPARATOR);
}

export function isIntelligenceReady(description: string): boolean {
  return description.trim().length >= INTELLIGENCE_READINESS_MIN_LENGTH;
}

export function narrativeExceedsLimit(
  messageBodies: string[],
  maxLength: number = MAX_SITUATION_NARRATIVE_LENGTH,
): boolean {
  return buildProvisionalNarrative(messageBodies).length > maxLength;
}
