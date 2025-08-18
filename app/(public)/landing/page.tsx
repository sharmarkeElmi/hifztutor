// app/landing/page.tsx
// ===================================================
// HifzTutor — Landing Page (refined)
// - Tighter hero (less vertical space, clearer CTAs)
// - Stronger section separation with alternating bgs
// - Polished cards, consistent radii, shadows, spacing
// - Footer remains at the very end
// ===================================================

import Link from "next/link";

export default function LandingPage() {
  return (
    <>
      {/* ===== Hero (more compact) ===== */}
      <section className="relative isolate">
        {/* Background: soft vertical gradient + subtle grid overlay */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white via-[#fafafa] to-[#eef2f7]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(60%_60%_at_50%_20%,black,transparent)] bg-[linear-gradient(to_right,rgba(2,6,23,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(2,6,23,0.06)_1px,transparent_1px)] bg-[size:28px_28px]"
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            {/* Left: headline + copy + CTAs */}
            <div className="lg:col-span-6 xl:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-[#1d7f63]" />
                Live 1:1 lessons with vetted tutors
              </div>

              <h1 className="mt-4 text-4xl sm:text-[40px] font-extrabold leading-[1.1] tracking-tight">
                <span className="bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Master Qur’an memorisation
                </span>
                <br />
                <span className="text-slate-700">with trusted Hifz tutors</span>
              </h1>

              <p className="mt-4 max-w-2xl text-[17px] text-slate-700">
                Personalised one‑on‑one sessions for memorisation, Tajwīd, and Arabic — where authentic tradition meets modern tools.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                {/* Primary CTA — brand yellow */}
                <Link
                  href="/student/signup"
                  className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-base font-semibold text-black bg-[#FFD600] shadow-[0_6px_20px_rgba(255,214,0,0.35)] transition hover:translate-y-[-1px] hover:shadow-[0_10px_26px_rgba(255,214,0,0.45)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD600]"
                >
                  Get started
                </Link>

                {/* Secondary CTA — outline */}
                <Link
                  href="/tutors"
                  className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-base font-semibold border border-slate-300 text-slate-800 bg-white/90 backdrop-blur hover:bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300"
                >
                  Find a HifzTutor
                </Link>
              </div>

              {/* Mini bullets */}
              <ul className="mt-5 space-y-2 text-sm text-slate-600">
                <li>• Live video &amp; crystal‑clear audio</li>
                <li>• Track progress &amp; memorisation goals</li>
                <li>• Tutors vetted for Tajwīd &amp; methodology</li>
              </ul>
            </div>

            {/* Right: visual placeholder card (tighter) */}
            <div className="lg:col-span-6 xl:col-span-5 relative">
              <div className="relative mx-auto w-full max-w-lg">
                <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur">
                  <div className="aspect-[4/3] grid place-items-center">
                    <div className="text-center px-6">
                      <div className="text-xs uppercase tracking-wider text-slate-500">Preview</div>
                      <div className="mt-1 text-slate-700">Hero image / illustration goes here</div>
                      <div className="mt-2 text-xs text-slate-400">(Drop in a branded photo or product screenshot)</div>
                    </div>
                  </div>
                </div>
                {/* Accent badge */}
                <div className="absolute -top-3 -right-3 rounded-full bg-[#1d7f63] text-white text-xs font-semibold px-3 py-1 shadow">
                  Live lessons
                </div>
              </div>
            </div>
          </div>

          {/* Stats strip (compact) */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
            {[
              { k: "4.9/5", v: "Avg. tutor rating" },
              { k: "1,200+", v: "Lessons completed" },
              { k: "60+", v: "Countries learning" },
              { k: "100%", v: "Vetted tutors" },
            ].map((s, i) => (
              <div key={i} className="rounded-xl bg-white p-3 text-center shadow-sm">
                <div className="text-lg font-bold text-slate-900">{s.k}</div>
                <div className="text-xs text-slate-600 mt-1">{s.v}</div>
              </div>
            ))}
          </div>

          {/* Trusted by */}
          <div className="mt-6 text-slate-600">
            <div className="text-xs uppercase tracking-wider">Trusted by learners worldwide</div>
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-8 rounded-lg bg-gradient-to-br from-slate-200 to-slate-100 border border-slate-200"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Divider ===== */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* ===== Value Proposition (Upgraded) ===== */}
      <section className="relative bg-white">
        {/* subtle top divider */}
        <div aria-hidden className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          {/* Eyebrow + Heading */}
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1d7f63]" />
              Value you can feel from lesson one
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              Your journey to master the Qur’an starts here
            </h2>
            <p className="mt-3 text-slate-700 max-w-2xl">
              Learn with Ijāzah-certified tutors in focused 1:1 sessions. Every lesson blends Qur’anic tradition with modern,
              distraction-free tools designed for memorisation, Tajwīd, and confident recitation.
            </p>
          </div>

          {/* Cards */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1 */}
            <div className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition
                      hover:shadow-md hover:border-slate-300">
              {/* accent ring on hover */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-transparent group-hover:ring-[#e9f6f1]/70" />
              {/* icon */}
              <div className="mb-4 h-10 w-10 grid place-items-center rounded-xl bg-[#e8f4f0] text-[#1d7f63]">
                {/* book-icon (inline SVG) */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16h-13a2.5 2.5 0 0 0-2.5 2.5V5.5Z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 6h11" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Authentic expertise</h3>
              <p className="mt-2 text-sm text-slate-600">
                Learn from Ijāzah-certified tutors with verified methodology and a gentle, structured approach.
              </p>
              <div className="mt-4 h-px w-10 bg-slate-200 transition group-hover:w-16" />
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                <li>• Vetted credentials</li>
                <li>• Clear Tajwīd guidance</li>
              </ul>
            </div>

            {/* Card 2 */}
            <div className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition
                      hover:shadow-md hover:border-slate-300">
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-transparent group-hover:ring-[#fff5bf]/70" />
              <div className="mb-4 h-10 w-10 grid place-items-center rounded-xl bg-[#FFF2A1] text-black">
                {/* clock-icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">One-on-one, on your schedule</h3>
              <p className="mt-2 text-sm text-slate-600">
                Flexible times, consistent cadence. Build momentum with weekly slots that actually fit your life.
              </p>
              <div className="mt-4 h-px w-10 bg-slate-200 transition group-hover:w-16" />
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                <li>• Smooth booking</li>
                <li>• Calendar reminders</li>
              </ul>
            </div>

            {/* Card 3 */}
            <div className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition
                      hover:shadow-md hover:border-slate-300">
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-transparent group-hover:ring-[#e9eefc]/70" />
              <div className="mb-4 h-10 w-10 grid place-items-center rounded-xl bg-[#eaf1ff] text-slate-800">
                {/* target-icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 5V3M19 12h2M12 19v2M3 12H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Guided by your goals</h3>
              <p className="mt-2 text-sm text-slate-600">
                Track memorisation, set weekly targets, and celebrate milestones with your tutor’s support.
              </p>
              <div className="mt-4 h-px w-10 bg-slate-200 transition group-hover:w-16" />
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                <li>• Goal-based lesson plans</li>
                <li>• Progress dashboards</li>
              </ul>
            </div>
          </div>

          {/* Mini checklist row */}
          <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <ul className="grid gap-2 sm:grid-cols-3 text-sm text-slate-700">
              <li className="flex items-center gap-2">
                <span className="inline-block h-5 w-5 rounded-full bg-[#1d7f63] text-white grid place-items-center text-[11px]">✓</span>
                Live HD audio/video
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-5 w-5 rounded-full bg-[#1d7f63] text-white grid place-items-center text-[11px]">✓</span>
                Interactive Qur’an tools
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-5 w-5 rounded-full bg-[#1d7f63] text-white grid place-items-center text-[11px]">✓</span>
                Safe & vetted community
              </li>
            </ul>

            <Link
              href="/tutors"
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-base font-semibold border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300"
            >
              Find your tutor
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Key Features (Upgraded) ===== */}
      <section className="relative bg-[#f5f7fb]">
        {/* soft top divider */}
        <div aria-hidden className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300/60 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1d7f63]" />
              Essential Tools for Personalised Learning
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              Built for memorisation, Tajwīd, and real progress
            </h2>
            <p className="mt-3 text-slate-700 max-w-2xl">
              Every lesson uses thoughtful, distraction-free tools to help you focus, practise correctly, and stay consistent.
            </p>
          </div>

          {/* Feature grid */}
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Streamlined booking */}
            <article className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300">
              <div className="mb-4 h-10 w-10 grid place-items-center rounded-xl bg-[#eaf1ff] text-slate-800">
                {/* calendar icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 3v4M16 3v4M3.5 10.5h17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Streamlined booking</h3>
              <p className="mt-2 text-sm text-slate-600">
                Check tutor availability and book in seconds. Recurring slots keep your momentum.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                <li>• Weekly cadence</li>
                <li>• Calendar reminders</li>
              </ul>
            </article>

            {/* 2. Interactive Qur’an tools */}
            <article className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300">
              <div className="mb-4 h-10 w-10 grid place-items-center rounded-xl bg-[#e9f6f1] text-[#1d7f63]">
                {/* pen/highlight icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 17l-1 4 4-1L19 8l-3-3L4 17z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M14 5l3 3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Interactive Qur’an tools</h3>
              <p className="mt-2 text-sm text-slate-600">
                Highlight āyāt, annotate Tajwīd rules, and navigate sūrahs together in real time.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                <li>• Live pointer &amp; notes</li>
                <li>• Clean, distraction-free view</li>
              </ul>
            </article>

            {/* 3. HD audio/video */}
            <article className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300">
              <div className="mb-4 h-10 w-10 grid place-items-center rounded-xl bg-[#fff5bf] text-black">
                {/* mic icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="8" y="3" width="8" height="12" rx="4" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 11v1a7 7 0 0 0 14 0v-1M12 21v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Crystal-clear recitation</h3>
              <p className="mt-2 text-sm text-slate-600">
                Low-latency audio/video built on LiveKit so your makhārij are heard accurately.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                <li>• Echo control</li>
                <li>• Automatic device checks</li>
              </ul>
            </article>

            {/* 4. Goal tracking */}
            <article className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300">
              <div className="mb-4 h-10 w-10 grid place-items-center rounded-xl bg-[#eaf1ff] text-slate-800">
                {/* target icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 5V3M19 12h2M12 19v2M3 12H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Guided by your goals</h3>
              <p className="mt-2 text-sm text-slate-600">
                Set weekly targets, track memorisation, and celebrate milestones with your tutor.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                <li>• Streaks &amp; milestones</li>
                <li>• Lesson summaries</li>
              </ul>
            </article>

            {/* 5. Messaging */}
            <article className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300">
              <div className="mb-4 h-10 w-10 grid place-items-center rounded-xl bg-[#e9f6f1] text-[#1d7f63]">
                {/* chat icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M20 12a7 7 0 1 1-3.2-5.9L21 5l-1 3.5A7 7 0 0 1 20 12Z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 12h8M8 9h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Stay connected</h3>
              <p className="mt-2 text-sm text-slate-600">
                Ask questions, confirm homework, and coordinate schedules between lessons.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                <li>• Inbox with unread badges</li>
                <li>• Clean, focused threads</li>
              </ul>
            </article>

            {/* 6. Safe & vetted */}
            <article className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300">
              <div className="mb-4 h-10 w-10 grid place-items-center rounded-xl bg-[#fff5bf] text-black">
                {/* shield icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 3l7 3v6c0 4.5-3 7-7 9-4-2-7-4.5-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9.5 12.5l2 2 3-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Safe &amp; vetted community</h3>
              <p className="mt-2 text-sm text-slate-600">
                Tutor credentials are reviewed. Clear policies keep sessions respectful and focused.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                <li>• Verified profiles</li>
                <li>• Report &amp; support options</li>
              </ul>
            </article>
          </div>

          {/* subtle bottom callout */}
          <div className="mt-10 rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-slate-700">
              Ready to see these tools in action? Book a lesson and start your journey.
            </p>
            <Link
              href="/student/signup"
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-black bg-[#FFD600] shadow-[0_6px_20px_rgba(255,214,0,0.35)] hover:translate-y-[-1px] hover:shadow-[0_10px_26px_rgba(255,214,0,0.45)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD600]"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* ===== How It Works (white, cards) ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            Start Your Hifz Journey in 3 Simple Steps
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              {
                step: "Step 1",
                title: "Find your tutor",
                body: "Browse Ijaza‑certified tutors and choose the one who aligns with your goals.",
              },
              {
                step: "Step 2",
                title: "Book your lesson",
                body: "Pick a time that works for you, share your goals, and get ready to begin.",
              },
              {
                step: "Step 3",
                title: "Learn and grow",
                body: "Join live 1:1 lessons, track progress, and achieve your goals with expert guidance.",
              },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="text-[#1d7f63] font-semibold text-xs tracking-wider uppercase">{s.step}</div>
                <h3 className="mt-2 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/tutors"
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-base font-semibold border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300"
            >
              Find your tutor
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Social Proof (soft panel) ===== */}
      <section className="bg-[#f5f7fb]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            Why Students Love Learning on HifzTutor
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {[
              {
                q: "“Ustadh Omar is incredible! He’s patient, clear, and uses the Quran tools on HifzTutor to highlight Āyāt and Tajwīd rules during lessons. I’ve already memorised six sūrahs!”",
                a: "— Ahmed, Student",
              },
              {
                q: "“Sister Amina’s tips and encouragement changed how I feel about reciting. I’ve built real confidence in my Tajwīd.”",
                a: "— Fatima, Student",
              },
              {
                q: "“Sheikh Abdullah makes memorisation fun for my daughter—she’s learning faster and looks forward to every lesson.”",
                a: "— Khadija, Parent",
              },
              {
                q: "“Ustadh Khalid tailors lessons to my busy schedule. I’ve made more progress in two months than I expected.”",
                a: "— Mohammed, Student",
              },
            ].map((t, i) => (
              <figure
                key={i}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <blockquote className="text-slate-800">{t.q}</blockquote>
                <figcaption className="mt-3 text-sm text-slate-500">{t.a}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ (white) ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            Your Questions, Answered
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {[
              { q: "Can I join HifzTutor as a beginner?", a: "Of course! Our tutors work with all levels, from your first sūrah to perfecting Tajwīd." },
              { q: "Are trial lessons available?", a: "Yes — trial lessons help you experience a tutor’s style before committing." },
              { q: "What happens if I miss a lesson?", a: "You can reschedule based on the tutor’s cancellation policy, shown on their profile." },
              { q: "Can I learn both Tajwīd and Quranic Arabic?", a: "Absolutely. Many tutors specialise across memorisation, Tajwīd, and Arabic." },
              { q: "What do I need for lessons?", a: "A stable internet connection and a device with a camera/mic. Works on laptop, tablet, or phone." },
              { q: "Can I contact my tutor between lessons?", a: "Yes — use messaging to ask questions, share updates, or co‑ordinate schedules." },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 p-6 bg-white shadow-sm">
                <h3 className="font-semibold text-slate-900">{item.q}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Become a Tutor (distinct brand panel) ===== */}
      <section className="bg-[#1d7f63] text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Teach, Inspire, and Empower with HifzTutor</h2>
              <p className="mt-3 text-white/90">
                Earn competitively, preserve tradition, and empower students worldwide — on your schedule, with your rates.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-white/90">
                <li>• Reach dedicated students in the West</li>
                <li>• Set your own schedule and rates</li>
                <li>• Teach with interactive Quran tools</li>
              </ul>
              <div className="mt-8">
                <Link
                  href="/tutor/signup"
                  className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-base font-semibold bg-white text-[#1d7f63] hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
                >
                  Become a HifzTutor
                </Link>
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 p-6 shadow-sm">
              <p className="text-sm text-white/90">
                “HifzTutor makes it simple to teach with clarity — schedules, messaging, and live tools are all in one place.”
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Final CTA (white) ===== */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            Begin Your Hifz Journey Now
          </h2>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/student/signup"
              className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-base font-semibold text-black bg-[#FFD600] shadow-[0_6px_20px_rgba(255,214,0,0.35)] transition hover:translate-y-[-1px] hover:shadow-[0_10px_26px_rgba(255,214,0,0.45)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD600]"
            >
              Get started
            </Link>
            <Link
              href="/tutors"
              className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-base font-semibold border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300"
            >
              Find a HifzTutor
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Join from any device with camera &amp; mic — laptop, tablet, or phone.
          </p>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="relative isolate bg-[#0f172a] text-slate-300">
        <div className="absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent to-[#0f172a]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-white font-extrabold text-xl">HifzTutor</div>
              <p className="mt-3 text-sm text-slate-400">
                Learn the Qur’an with trusted tutors. Personalised 1:1 lessons for memorisation, Tajwīd, and Arabic.
              </p>
            </div>

            {[
              {
                heading: "Product",
                links: [
                  { label: "Find a tutor", href: "/tutors" },
                  { label: "Lessons", href: "/student/dashboard" },
                  { label: "Pricing (soon)", href: "/landing" },
                ],
              },
              {
                heading: "For Tutors",
                links: [
                  { label: "Become a HifzTutor", href: "/tutor/signup" },
                  { label: "Tutor sign in", href: "/tutor/signin" },
                ],
              },
              {
                heading: "Company",
                links: [
                  { label: "About", href: "/landing" },
                  { label: "Contact", href: "/landing" },
                  { label: "Terms & Privacy", href: "/landing" },
                ],
              },
            ].map((col, i) => (
              <div key={i}>
                <div className="text-sm font-semibold tracking-wider text-white">{col.heading}</div>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-sm text-slate-400 hover:text-white transition"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} HifzTutor. All rights reserved.
            </p>

            <div className="flex items-center gap-3">
              <Link
                href="/student/signup"
                className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-black bg-[#FFD600] hover:brightness-95 transition"
              >
                Get started
              </Link>
              <Link
                href="/tutor/signup"
                className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-white border border-white/20 hover:bg-white/10 transition"
              >
                Become a tutor
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}