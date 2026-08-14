"use client";

import { useState } from "react";

interface FieldDef {
  id: "name" | "contact" | "genre";
  label: string;
  placeholder: string;
}

interface OpencdjFormProps {
  nameLabel: string;
  namePlaceholder: string;
  contactLabel: string;
  contactPlaceholder: string;
  genreLabel: string;
  genrePlaceholder: string;
  submitText: string;
  successMessage: string;
}

/** Porta da lógica de form de opencdj/src/App.jsx — 3 campos fixos (não mais
 * um array configurável de campos, ver plano). Inclui um honeypot: bots que
 * preenchem todo input do form marcam esse campo, que fica fora da tela
 * (opencdj.css .honeypot) e nunca é preenchido por gente de verdade. */
export function OpencdjForm({
  nameLabel,
  namePlaceholder,
  contactLabel,
  contactPlaceholder,
  genreLabel,
  genrePlaceholder,
  submitText,
  successMessage,
}: OpencdjFormProps) {
  const fields: FieldDef[] = [
    { id: "name", label: nameLabel, placeholder: namePlaceholder },
    { id: "contact", label: contactLabel, placeholder: contactPlaceholder },
    { id: "genre", label: genreLabel, placeholder: genrePlaceholder },
  ];

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: "" });
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    fields.forEach((field) => {
      if (!formData[field.id]?.trim()) {
        next[field.id] = "campo obrigatório";
      }
    });
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validate();
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/opencdj/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, website_url: honeypot }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error);
      }
      setSubmitted(true);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "não conseguimos registrar sua inscrição agora. tente de novo em alguns minutos, ou manda um email direto pra rz@bit-lab.tech";
      setErrors({ _global: message });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="success">
        <div className="successIcon">△</div>
        <p>{successMessage}</p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {/* honeypot — invisível pra gente, bots costumam preencher todo campo */}
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website_url">Website</label>
        <input
          id="website_url"
          name="website_url"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {fields.map((field, i) => (
        <div key={field.id} className="fieldGroup">
          <label htmlFor={field.id} className="label">
            <span className="fieldNum">[{String(i + 1).padStart(2, "0")}]</span>
            {field.label}
            <span className="required"> *</span>
          </label>
          <input
            id={field.id}
            name={field.id}
            type="text"
            placeholder={field.placeholder}
            className={`input${errors[field.id] ? " inputError" : ""}`}
            value={formData[field.id] || ""}
            onChange={handleChange}
          />
          {errors[field.id] && <span className="errorMsg">! {errors[field.id]}</span>}
        </div>
      ))}

      {errors._global && <span className="errorMsg">! {errors._global}</span>}

      <button type="submit" className="submitBtn" disabled={submitting}>
        <span>▶ {submitText}</span>
      </button>
    </form>
  );
}
