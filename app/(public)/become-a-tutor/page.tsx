// app/(public)/become-a-tutor/page.tsx
// Polished, elegant public page that uses only brand colors & fonts
// Brand colors used:
//  - Primary Yellow: #FFD60A
//  - Deep Green:     #004643
//  - Off White:      #F9F9F9
//  - Accent Mint:    #E9F6F1 (tint of brand)
//  - Slate neutrals for readable text

import Link from "next/link";

export default function BecomeATutorPage() {
  return (
    <main className="min-h-screen bg-[#F9F9F9] font-sans text-slate-900">
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        {/* soft background tint + subtle gradient corner */}
        <div className="absolute inset-0 bg-[linear-gradient(115deg,#FFF7C1_0%,#FFF0A8_35%,#FFF2B8_60%,#FFFFFF_100%)]" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            {/* Copy */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#004643" }} />
                Teach Qur’an. Change lives.
              </div>
              <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight text-slate-900">
                Become a <span className="text-slate-900">HifzTutor</span>
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-700">
                Share your ijāzah-backed knowledge in focused 1:1 lessons. Flexible schedule, fair pay, and tools that
                make memorisation and Tajwīd easier for your students.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/tutor/signup"
                  className="inline-flex items-center justify-center rounded-xl bg-[#FFD60A] px-5 py-3 text-sm font-semibold text-black shadow-[0_6px_20px_rgba(255,214,10,0.35)] transition will-change-transform hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(255,214,10,0.45)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD60A]"
                >
                  Apply as Tutor
                </Link>
                <Link
                  href="#how-it-works"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  See how it works
                </Link>
              </div>

              {/* Trust strip */}
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-2"><Check /> Vetted community</span>
                <span className="inline-flex items-center gap-2"><Check /> Flexible hours</span>
                <span className="inline-flex items-center gap-2"><Check /> Fast payouts</span>
              </div>
            </div>

            {/* Decorative card */}
            <div className="relative">
              <div className="mx-auto w-full max-w-md rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
                <div className="rounded-xl bg-[#004643] p-5 text-[#FFD60A]"><span className="text-sm font-semibold">Your Tutor Dashboard</span>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-white/90">
                    <div className="rounded-md bg-white/10 p-3">
                      <div className="text-lg font-bold text-[#FFD60A]">12</div>
                      students
                    </div>
                    <div className="rounded-md bg-white/10 p-3">
                      <div className="text-lg font-bold text-[#FFD60A]">28</div>
                      lessons/mo
                    </div>
                    <div className="rounded-md bg-white/10 p-3">
                      <div className="text-lg font-bold text-[#FFD60A]">4.9</div>
                      rating
                    </div>
                  </div>
                  <div className="mt-4 rounded-md bg-[#E9F6F1] p-3 text-[#004643]">
                    “Beautiful recitation, clear Tajwīd tips.” — Fatimah A.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Why Teach with Us ===== */}
      <section className="relative bg-white">
        <div aria-hidden className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#004643" }} />
              Why teach with HifzTutor?
            </div>
            <h2 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Do meaningful work with modern tools
            </h2>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              iconBg="#E9F6F1"
              iconColor="#004643"
              title="Purposeful impact"
              points={["Guide memorisation with care", "Support confident recitation"]}
            />
            <FeatureCard
              iconBg="#FFF2A1"
              iconColor="#111827"
              title="Flexible schedule"
              points={["Teach from anywhere", "Set your own hours"]}
            />
            <FeatureCard
              iconBg="#EAF1FF"
              iconColor="#0F172A"
              title="Fair earnings"
              points={["Transparent payouts", "Grow your student base"]}
            />
          </div>
        </div>
      </section>

      {/* ===== How it Works ===== */}
      <section id="how-it-works" className="relative bg-[#F9F9F9]">
        <div aria-hidden className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-slate-200/70 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#004643" }} />
              How it works
            </div>
            <h2 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Simple, respectful onboarding
            </h2>
          </div>

          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            <StepCard index={1} title="Apply & verify" desc="Create your tutor profile and share credentials." />
            <StepCard index={2} title="Meet students" desc="Get matched based on availability and goals." />
            <StepCard index={3} title="Teach & grow" desc="Deliver great lessons and build a reputation." />
          </ol>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h3 className="text-xl md:text-2xl font-extrabold text-slate-900">Ready to make a difference?</h3>
                <p className="mt-1 text-sm text-slate-700">Join HifzTutor and inspire confident, beautiful recitation.</p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/tutor/signup"
                  className="inline-flex items-center justify-center rounded-xl bg-[#FFD60A] px-5 py-3 text-sm font-semibold text-black shadow-[0_6px_20px_rgba(255,214,10,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(255,214,10,0.45)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD60A]"
                >
                  Apply now
                </Link>
                <Link
                  href="/landing"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Learn more
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ---------------------- Small presentational pieces ---------------------- */
function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeatureCard({
  iconBg,
  iconColor,
  title,
  points,
}: {
  iconBg: string;
  iconColor: string;
  title: string;
  points: string[];
}) {
  return (
    <article className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300">
      <div className="mb-4 h-10 w-10 grid place-items-center rounded-xl" style={{ backgroundColor: iconBg, color: iconColor }}>
        {/* simple book-like glyph */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 4h11v15H8a2 2 0 0 0-2 2V4Z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 7h9" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#004643" }} />
            {p}
          </li>
        ))}
      </ul>
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-transparent group-hover:ring-[#E9F6F1]" />
    </article>
  );
}

function StepCard({ index, title, desc }: { index: number; title: string; desc: string }) {
  return (
    <li className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 bg-white text-sm font-bold text-slate-800" style={{ color: "#004643" }}>
          {index}
        </div>
        <div>
          <h4 className="font-semibold text-slate-900">{title}</h4>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{desc}</p>
        </div>
      </div>
    </li>
  );
}
