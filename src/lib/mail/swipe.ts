export function swipeAxis(
  dx: number,
  dy: number,
): "horizontal" | "vertical" | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return null;
  return Math.abs(dx) > Math.abs(dy) * 1.3 ? "horizontal" : "vertical";
}
export function swipeRelease(
  offset: number,
  width: number,
): "delete" | "reveal" | "close" {
  if (width > 0 && offset <= -Math.max(150, width * 0.6)) return "delete";
  return offset <= -42 ? "reveal" : "close";
}
