"use client";

import Footer from "@/app/components/Footer";
import TutorsBrowse from "@features/tutors/TutorsBrowse";

export default function TutorsPage() {
  return (
    <>
      <TutorsBrowse basePath="/tutors" />
      <Footer />
    </>
  );
}
