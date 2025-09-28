import { redirect } from "next/navigation";

export default async function TutorSignInRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const rawNext = Array.isArray(resolvedParams?.next) ? resolvedParams?.next[0] : resolvedParams?.next;
  const nextQuery = rawNext ? `?next=${encodeURIComponent(rawNext)}` : "";
  redirect(`/signin${nextQuery}`);
}
