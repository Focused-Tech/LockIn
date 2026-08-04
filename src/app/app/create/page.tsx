import { redirect } from "next/navigation";

/**
 * RETIRED. The version-one "Host a contest" builder (SlateBuilder) is no longer in the
 * player flow — the creator journey is creator_builder_v2 at /app/creator. This route
 * only redirects there (deep links / saved URLs land on the v2 hub, which gates the
 * creator agreement). SlateBuilder is unreachable from the flow.
 */
export default function CreatePageRedirect() {
  redirect("/app/creator");
}
