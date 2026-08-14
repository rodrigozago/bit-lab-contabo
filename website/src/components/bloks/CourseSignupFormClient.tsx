"use client";

import { useState } from "react";

interface CourseSignupFormClientProps {
  name: string;
  instagram: string;
  whatsapp: string;
  experienceLabel: string;
  experienceOptions: string;
  motivationLabel: string;
  motivationPlaceholder?: string;
  submitText: string;
  successMessage: string;
}

/** Form de inscrição no curso — nome/instagram/whatsapp vêm travados da
 * sessão (mesmo padrão do OpencdjForm), experiência é um select montado a
 * partir de `experienceOptions` (texto comma-separated, mesma convenção de
 * DataTableBlok.headers/PricingPlanBlok.benefits). Honeypot mesmo padrão do
 * StudioContactForm/OpencdjForm. */
export function CourseSignupFormClient({
  name,
  instagram,
  whatsapp,
  experienceLabel,
  experienceOptions,
  motivationLabel,
  motivationPlaceholder,
  submitText,
  successMessage,
}: CourseSignupFormClientProps) {
  const options = experienceOptions
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const [experience, setExperience] = useState(options[0] ?? "");
  const [motivation, setMotivation] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!experience) {
      setError("preenche o campo obrigatório");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/curso-discotecagem/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience, motivation, website_url: honeypot }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error);
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "não conseguimos registrar sua inscrição agora. tente de novo em alguns minutos, ou manda um email direto pra rz@bit-lab.tech",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <p className="text-body">{successMessage}</p>;
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website_url">Website</label>
        <input
          id="website_url"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="course-name" className="text-label text-fg-muted">
          Nome
        </label>
        <input
          id="course-name"
          type="text"
          className="border-border bg-transparent text-body border-b py-2 outline-none disabled:opacity-60"
          value={name}
          disabled
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="course-instagram" className="text-label text-fg-muted">
          Instagram
        </label>
        <input
          id="course-instagram"
          type="text"
          className="border-border bg-transparent text-body border-b py-2 outline-none disabled:opacity-60"
          value={instagram}
          disabled
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="course-whatsapp" className="text-label text-fg-muted">
          WhatsApp
        </label>
        <input
          id="course-whatsapp"
          type="text"
          className="border-border bg-transparent text-body border-b py-2 outline-none disabled:opacity-60"
          value={whatsapp}
          disabled
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="course-experience" className="text-label text-fg-muted">
          {experienceLabel}
        </label>
        <select
          id="course-experience"
          className="border-border bg-transparent text-body border-b py-2 outline-none focus:border-accent"
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="course-motivation" className="text-label text-fg-muted">
          {motivationLabel}
        </label>
        <textarea
          id="course-motivation"
          rows={4}
          placeholder={motivationPlaceholder}
          className="border-border bg-transparent text-body resize-vertical border-b py-2 outline-none focus:border-accent"
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
        />
      </div>

      {error && <p className="text-label text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="text-label mt-4 w-fit border-b border-accent pb-1 disabled:opacity-50"
      >
        {submitting ? "ENVIANDO..." : submitText}
      </button>
    </form>
  );
}
