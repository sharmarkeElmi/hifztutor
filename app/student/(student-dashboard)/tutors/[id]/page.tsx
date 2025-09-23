"use client";

import { useParams } from "next/navigation";
import TutorProfile from "@features/tutors/TutorProfile";

export default function StudentTutorProfilePage() {
  const params = useParams<{ id: string }>();
  const tutorId = params?.id;
  if (!tutorId) return null;
  return <TutorProfile tutorId={tutorId} basePath="/student/tutors" />;
}
