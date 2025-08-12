// app/landing/page.tsx
// ==============================
// Landing Page Component
// This is the main public-facing entry point after redirect from "/" (root).
// It serves as the homepage for the HifzTutor platform, providing an intro
// and basic context about the platform's purpose.
// ==============================

export default function Home() {
  return (
    <section className="space-y-4">
      {/* Page Title */}
      <h1 className="text-3xl font-bold">Welcome to HifzTutor</h1>

      {/* Introductory Description */}
      <p className="text-muted-foreground">
        We’re building a platform to connect Hifz tutors and students for live, low-latency lessons.
      </p>
    </section>
  );
}
