"use client";

import { useState } from "react";
import { storyblokEditable } from "@storyblok/react/rsc";
import type { StudioContactBlok } from "@/lib/types";

/** Form de contato público da landing do studio — sem sessão exigida
 * (diferente do form do /opencdj). Honeypot mesmo padrão do OpencdjForm:
 * campo escondido que bots costumam preencher, se vier preenchido a
 * resposta finge sucesso sem notificar ninguém (ver submit/route.ts). */
export function StudioContactForm({ blok }: { blok: StudioContactBlok }) {
  const theme = blok.theme ?? "dark";

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim() || !message.trim()) {
      setError("preenche todos os campos");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/contact/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, message, website_url: honeypot }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error);
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "não conseguimos enviar agora. tenta de novo em alguns minutos.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="contato"
      {...storyblokEditable(blok)}
      className={`theme--${theme} grid-12 py-24 md:py-32`}
    >
      <div className="col-span-12 md:col-span-6">
        <h2 className="text-heading mb-4">{blok.heading}</h2>
        {blok.intro && <p className="text-body text-fg-muted max-w-md">{blok.intro}</p>}
      </div>

      <div className="col-span-12 md:col-span-6">
        {submitted ? (
          <p className="text-body">Mensagem recebida — a gente responde em breve.</p>
        ) : (
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
              <label htmlFor="contact-name" className="text-label text-fg-muted">
                Nome
              </label>
              <input
                id="contact-name"
                type="text"
                className="border-border bg-transparent text-body border-b py-2 outline-none focus:border-accent"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="contact-contact" className="text-label text-fg-muted">
                E-mail ou Instagram
              </label>
              <input
                id="contact-contact"
                type="text"
                className="border-border bg-transparent text-body border-b py-2 outline-none focus:border-accent"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="contact-message" className="text-label text-fg-muted">
                Mensagem
              </label>
              <textarea
                id="contact-message"
                rows={4}
                className="border-border bg-transparent text-body resize-vertical border-b py-2 outline-none focus:border-accent"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {error && <p className="text-label text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="text-label mt-4 w-fit border-b border-accent pb-1 disabled:opacity-50"
            >
              {submitting ? "ENVIANDO..." : "ENVIAR"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
