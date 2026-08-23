/**
 * THE ONE CONTAINER.
 *
 * Header contents and page contents must share a single measuring stick, or they drift: the header
 * bar is full-bleed (its BACKGROUND spans the viewport) while its CONTENTS have to line up exactly
 * with the lane cards below. Two separate rules that happen to carry the same numbers will diverge
 * the first time one of them is edited — so there is one component, used in both places, and the
 * width lives in exactly one CSS class (`.lk-web-shell`).
 *
 * Usage:
 *   <header className="lk-web-header">      full-bleed background
 *     <Shell className="lk-web-headrow">    contents, aligned to the body
 *   <Shell as="section" className="lk-web-sec">
 */
export function Shell({
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  as?: "div" | "section" | "footer" | "nav";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={className ? `lk-web-shell ${className}` : "lk-web-shell"} {...rest}>
      {children}
    </Tag>
  );
}
