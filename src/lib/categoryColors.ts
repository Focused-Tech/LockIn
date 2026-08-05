import { categoryTint } from "@/lib/practice/tints";

/**
 * explore.html / slate_detail.html category palette: [edge, darker shoulder, soft fill].
 * ONE source for the category-coloured left edge used by the Floor card and the slate
 * detail leg cards. Falls back to the app's per-category tint for anything off-list.
 */
const CAT_COLORS: Record<string, [string, string]> = {
  MLB: ["#3E9BE9", "#1B4B74"],
  SOCCER: ["#2FB98A", "#166B4F"],
  NBA: ["#FF5A1F", "#8E2C01"],
  NASCAR: ["#E0432C", "#7E1F13"],
  AWARDS: ["#C05CF5", "#5B2A78"],
  NFL: ["#F0C463", "#7A5F16"],
  TENNIS: ["#3E9BE9", "#1B4B74"],
};

/** [edge, shoulder] for a category. */
export function catColors(category: string): [string, string] {
  const hit = CAT_COLORS[category.toUpperCase()];
  if (hit) return hit;
  const c = categoryTint(category).color;
  return [c, c];
}

/** rgba(edge, .09) soft fill for a selected option, derived from the edge hex. */
export function catSoft(hex: string, alpha = 0.09): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
