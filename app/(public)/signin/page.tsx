import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/client-server";
import SignInClient from "./SignInClient";

function sanitizeRedirect(input?: string | null): string | null {
  if (!input) return null;
  if (!input.startsWith("/")) return null;
  if (input.startsWith("//")) return null;
  return input;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const rawNext = Array.isArray(resolvedParams?.next) ? resolvedParams?.next[0] : resolvedParams?.next;
  const safeNext = sanitizeRedirect(rawNext);
  const rawCheckEmail = Array.isArray(resolvedParams?.checkEmail)
    ? resolvedParams?.checkEmail[0]
    : resolvedParams?.checkEmail;
  const showCheckEmail = rawCheckEmail === "1";

  const supabase = await createSupabaseServerClient({ readOnly: true });
  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && userError.message !== "Auth session missing!") {
    console.error("Failed to verify existing session on /signin:", userError.message);
  }

  const userId = userData?.user?.id ?? null;
  if (userId) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("Failed to load role for signed-in user on /signin:", error.message);
    }
    const role = profile?.role;
    if (role === "student" || role === "tutor") {
      const dashboard = role === "tutor" ? "/tutor/dashboard" : "/student/dashboard";
      redirect(safeNext ?? dashboard);
    }
  }

  return (
    <div className="flex w-full items-center justify-center px-4 py-12">
      <SignInClient nextPath={safeNext} showCheckEmail={showCheckEmail} showRoleWarning={Boolean(userId)} />
    </div>
  );
}
