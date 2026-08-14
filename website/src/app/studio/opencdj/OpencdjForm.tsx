"use client";

import { useState } from "react";

interface OpencdjFormProps {
  name: string;
  instagram: string;
  whatsapp: string;
  genreLabel: string;
  genrePlaceholder: string;
  submitText: string;
  successMessage: string;
}

/** Porta da lógica de form de opencdj/src/App.jsx — nome/instagram/whatsapp
 * agora vêm da conta bit-lab (sessão SSO), pré-preenchidos e desabilitados:
 * não dá pra inscrever com dado diferente do cadastrado. `genre` continua o
 * único campo editável. Inclui honeypot: bots que preenchem todo input do
 * form marcam esse campo, que fica fora da tela (opencdj.css .honeypot) e
 * nunca é preenchido por gente de verdade. */
export function OpencdjForm({
  name,
  instagram,
  whatsapp,
  genreLabel,
  genrePlaceholder,
  submitText,
  successMessage,
}: OpencdjFormProps) {
  const [genre, setGenre] = useState("");
  const [about, setAbout] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genre.trim()) {
      setError("campo obrigatório");
      return;
    }
    setError("");

    setSubmitting(true);
    try {
      const res = await fetch("/opencdj/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre, about, website_url: honeypot }),
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
      setError(message);
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

      <div className="fieldGroup">
        <label htmlFor="name" className="label">
          <span className="fieldNum">[01]</span>
          NOME
        </label>
        <input id="name" type="text" className="input" value={name} disabled />
      </div>

      <div className="fieldGroup">
        <label htmlFor="instagram" className="label">
          <span className="fieldNum">[02]</span>
          INSTAGRAM
        </label>
        <input id="instagram" type="text" className="input" value={instagram} disabled />
      </div>

      <div className="fieldGroup">
        <label htmlFor="whatsapp" className="label">
          <span className="fieldNum">[03]</span>
          WHATSAPP
        </label>
        <input id="whatsapp" type="text" className="input" value={whatsapp} disabled />
      </div>

      <div className="fieldGroup">
        <label htmlFor="genre" className="label">
          <span className="fieldNum">[04]</span>
          {genreLabel}
          <span className="required"> *</span>
        </label>
        <input
          id="genre"
          name="genre"
          type="text"
          placeholder={genrePlaceholder}
          className={`input${error ? " inputError" : ""}`}
          value={genre}
          onChange={(e) => {
            setGenre(e.target.value);
            if (error) setError("");
          }}
        />
        {error && <span className="errorMsg">! {error}</span>}
      </div>

      <div className="fieldGroup">
        <label htmlFor="about" className="label">
          <span className="fieldNum">[05]</span>
          SOBRE VOCÊ / SEU PROJETO
        </label>
        <textarea
          id="about"
          name="about"
          rows={5}
          placeholder="conta um pouco sobre você, seu som — cola links de sets gravados, portfólio, redes..."
          className="input textarea"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
        />
      </div>

      <button type="submit" className="submitBtn" disabled={submitting}>
        <span>▶ {submitText}</span>
      </button>
    </form>
  );
}
