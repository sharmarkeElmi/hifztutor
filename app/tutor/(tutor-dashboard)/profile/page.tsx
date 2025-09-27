"use client";

import TutorProfileForm from "@features/tutors/settings/TutorProfileForm";

export default function TutorProfilePage() {
  return (
    <div className="py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="mx-auto text-center lg:mx-0 lg:max-w-2xl lg:text-left">
          <h1 className="text-2xl font-semibold text-[#111629]">My profile</h1>
          <p className="mt-1 text-sm text-slate-600">
            Update your tutor details, profile image, and the information students see on your public profile.
          </p>
        </div>
        <TutorProfileForm />
      </div>
    </div>
  );
}
