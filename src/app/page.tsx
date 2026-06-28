"use client";

import { BookOpen, ChevronUp, CheckCircle2, MessageSquare, Search, ShieldCheck, Sparkles, ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: <MessageSquare size={20} strokeWidth={1.8} />,
    title: "Submit questions live",
    description: "Ask during class without interrupting. Questions appear on the shared board instantly, linked to the active session.",
  },
  {
    icon: <ThumbsUp size={20} strokeWidth={1.8} />,
    title: "Upvote what matters most",
    description: "Classmates vote on the questions they also have. The most important ones rise to the top automatically.",
  },
  {
    icon: <CheckCircle2 size={20} strokeWidth={1.8} />,
    title: "Follow answers in real time",
    description: "Instructor answers publish live. Track status — New, Answered, or Follow-up — without refreshing.",
  },
  {
    icon: <BookOpen size={20} strokeWidth={1.8} />,
    title: "Access your course library",
    description: "FAQ, theory, and code references released by your instructor — organized by topic and searchable.",
  },
  {
    icon: <Search size={20} strokeWidth={1.8} />,
    title: "Track your own questions",
    description: "Look up any submission by email to see its status, answer, and whether classmates upvoted it.",
  },
  {
    icon: <ShieldCheck size={20} strokeWidth={1.8} />,
    title: "Private by design",
    description: "Your name only goes to the instructor. The public board shows questions anonymously — no account needed.",
  },
];

const STEPS = [
  {
    label: "01",
    title: "Get your access code",
    description: "Your instructor shares a unique code for each class or course. It takes seconds to join.",
  },
  {
    label: "02",
    title: "Join the class board",
    description: "Enter the code to unlock the live board. It's saved in your browser — no signup, no password.",
  },
  {
    label: "03",
    title: "Ask, upvote, and follow",
    description: "Submit questions, vote on your classmates', and watch instructor answers appear live.",
  },
];

const PREVIEW_QUESTIONS = [
  { votes: 14, text: "Can you walk through backpropagation with a concrete example?", status: "Answered", tag: "Neural Nets" },
  { votes: 9, text: "What's the practical difference between L1 and L2 regularization?", status: "New", tag: "Regularization" },
  { votes: 6, text: "How does attention handle variable-length sequences?", status: "Answered", tag: "Transformers" },
];

function ClassSignalLogoMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="cs-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2b9565" />
          <stop offset="100%" stopColor="#11583a" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="30" rx="9" fill="url(#cs-grad)" />
      <rect x="8" y="21" width="5" height="5" rx="1.5" fill="white" fillOpacity="0.95" />
      <rect x="16" y="15" width="5" height="11" rx="1.5" fill="white" fillOpacity="0.95" />
      <rect x="24" y="9" width="5" height="17" rx="1.5" fill="white" fillOpacity="0.95" />
      <path d="M7 31 L4 38 L15 31Z" fill="url(#cs-grad)" />
    </svg>
  );
}

function BoardPreview() {
  return (
    <div className="landing-preview" aria-hidden="true">
      <div className="landing-preview__bar">
        <div className="landing-preview__dots">
          <span /><span /><span />
        </div>
        <span className="landing-preview__title">ClassSignal · Live board</span>
        <span className="landing-preview__live">● Live</span>
      </div>
      <div className="landing-preview__questions">
        {PREVIEW_QUESTIONS.map((q, i) => (
          <div key={i} className={`landing-preview__q ${q.status === "Answered" ? "is-answered" : ""}`}>
            <div className="landing-preview__vote">
              <ChevronUp size={13} strokeWidth={2.5} />
              <strong>{q.votes}</strong>
            </div>
            <div className="landing-preview__body">
              <p>{q.text}</p>
              <div className="landing-preview__meta">
                <span className="landing-preview__tag">{q.tag}</span>
                <span className={`landing-preview__status ${q.status === "Answered" ? "is-answered" : ""}`}>
                  {q.status === "Answered" ? <><CheckCircle2 size={10} /> Answered</> : "New"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const saved = localStorage.getItem("live-course-qa-access-code");
    if (!saved) return;
    fetch("/api/questions/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_code: saved }),
    })
      .then((res) => {
        if (res.ok) router.replace("/questions");
        else localStorage.removeItem("live-course-qa-access-code");
      })
      .catch(() => undefined);
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/questions/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_code: trimmed }),
      });
      const data = await res.json() as { access?: unknown; message?: string };
      if (!res.ok || !data.access) {
        setError(data.message ?? "Invalid access code. Check with your instructor.");
        setLoading(false);
        return;
      }
      localStorage.setItem("live-course-qa-access-code", trimmed);
      router.push("/questions");
    } catch {
      setError("Unable to connect. Check your network and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="landing-page">
      {/* ── HERO ── */}
      <section className="landing-hero">
        <div className="shell landing-hero__inner">
          <div className="landing-hero__content">
            <div className="landing-eyebrow">
              <ClassSignalLogoMark size={22} />
              <span>ClassSignal</span>
              <span className="landing-eyebrow__sep" />
              Live classroom Q&amp;A
            </div>

            <h1 className="landing-h1">
              Every classroom question <em>heard</em> and <em>answered.</em>
            </h1>

            <p className="landing-sub">
              A live Q&A board for your class. Submit questions, upvote what matters,
              and follow instructor answers in real time — no app, no account required.
            </p>

            <div className="landing-access-card">
              <div className="landing-access-card__header">
                <div className="landing-access-card__icon">
                  <ShieldCheck size={17} strokeWidth={2} />
                </div>
                <div>
                  <strong>Enter your class access code</strong>
                  <span>Provided by your instructor · saved only in this browser</span>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="landing-access-form">
                <input
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste or type your code"
                  autoComplete="off"
                  maxLength={200}
                  required
                  autoFocus
                  className="landing-access-input"
                />
                <Button type="submit" disabled={loading} className="landing-access-btn">
                  {loading ? "Verifying…" : "Join class board →"}
                </Button>
              </form>
              {error && <p className="landing-access-error" role="alert">{error}</p>}
            </div>
          </div>

          <div className="landing-hero__visual">
            <BoardPreview />
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <div className="landing-bar shell">
        <span><CheckCircle2 size={14} /> No account needed</span>
        <span className="landing-bar__dot" />
        <span><ShieldCheck size={14} /> Questions are anonymous on the board</span>
        <span className="landing-bar__dot" />
        <span><Sparkles size={14} /> AI-assisted instructor answers</span>
      </div>

      {/* ── FEATURES ── */}
      <section className="landing-features shell">
        <div className="landing-section-label">What you get</div>
        <h2 className="landing-section-h2">Everything your class needs in one board</h2>
        <p className="landing-section-sub">
          One lightweight, focused Q&A layer designed around how live courses actually work.
        </p>
        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing-feature">
              <div className="landing-feature__icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="landing-steps-section">
        <div className="shell">
          <div className="landing-section-label">How it works</div>
          <h2 className="landing-section-h2">Up and running in under a minute</h2>
          <div className="landing-steps">
            {STEPS.map((step) => (
              <div key={step.label} className="landing-step">
                <div className="landing-step__num">{step.label}</div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="landing-cta shell">
        <div className="landing-cta__inner">
          <ClassSignalLogoMark size={48} />
          <h2>Ready to join your class board?</h2>
          <p>Ask your instructor for the access code and you're in — takes less than ten seconds.</p>
          <form onSubmit={handleSubmit} className="landing-access-form landing-access-form--cta">
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter your class access code"
              autoComplete="off"
              maxLength={200}
              required
              className="landing-access-input"
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Verifying…" : "Enter class board →"}
            </Button>
          </form>
          {error && <p className="landing-access-error" role="alert">{error}</p>}
        </div>
      </section>
    </div>
  );
}
