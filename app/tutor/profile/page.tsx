"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TutorProfilePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/tutor/settings?tab=my-profile");
  }, [router]);
  return null;
}
