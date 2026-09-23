export const LEFT_PANEL_DEFAULT = 260;
export const LEFT_PANEL_MIN = 220;
export const LEFT_PANEL_MAX = 360;
export const RIGHT_PANEL_DEFAULT = 360;
export const RIGHT_PANEL_MIN = 300;
export const RIGHT_PANEL_MAX = 520;
export const CENTER_MIN_WIDTH = 640;
export const DIVIDER_WIDTH = 8;
export const RIGHT_PREVIEW_WIDTH = 420;
export const LEFT_WIDTH_STORAGE_KEY = "aram.chat.panel.leftWidth";
export const RIGHT_WIDTH_STORAGE_KEY = "aram.chat.panel.rightWidth";

export function overlayBreakpoint(): number {
  return LEFT_PANEL_MIN + CENTER_MIN_WIDTH + RIGHT_PANEL_MIN + DIVIDER_WIDTH * 2;
}

export function shouldUseOverlay(viewportWidth: number): boolean {
  return viewportWidth < overlayBreakpoint();
}

export function clampLeftWidth(input: {
  proposed: number;
  rightWidth: number;
  viewportWidth: number;
}): number {
  return clampPanelWidth({
    proposed: input.proposed,
    min: LEFT_PANEL_MIN,
    max: LEFT_PANEL_MAX,
    otherWidth: input.rightWidth,
    viewportWidth: input.viewportWidth,
  });
}

export function clampRightWidth(input: {
  proposed: number;
  leftWidth: number;
  viewportWidth: number;
}): number {
  return clampPanelWidth({
    proposed: input.proposed,
    min: RIGHT_PANEL_MIN,
    max: RIGHT_PANEL_MAX,
    otherWidth: input.leftWidth,
    viewportWidth: input.viewportWidth,
  });
}

export function rightPanelDensity(width: number): "compact" | "roomy" {
  return width >= RIGHT_PREVIEW_WIDTH ? "roomy" : "compact";
}

function clampPanelWidth(input: {
  proposed: number;
  min: number;
  max: number;
  otherWidth: number;
  viewportWidth: number;
}): number {
  const available = input.viewportWidth - input.otherWidth - CENTER_MIN_WIDTH - DIVIDER_WIDTH * 2;
  const maxWidth = Math.min(input.max, Math.max(input.min, available));
  return Math.min(maxWidth, Math.max(input.min, input.proposed));
}
