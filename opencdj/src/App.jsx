import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import pageContent from './content/page.md'
import styles from './App.module.css'
import logoSvg from '../logo.svg'

const { data: frontmatter, content: markdownBody } = pageContent

function useTypewriter(text, speed = 90, delay = 800) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const indexRef = useRef(0)

  useEffect(() => {
    let interval
    setDisplayed('')
    setDone(false)
    indexRef.current = 0

    const start = setTimeout(() => {
      interval = setInterval(() => {
        indexRef.current += 1
        setDisplayed(text.slice(0, indexRef.current))
        if (indexRef.current >= text.length) {
          clearInterval(interval)
          setDone(true)
        }
      }, speed)
    }, delay)

    // cleanup cancels BOTH — the pending timeout and any running interval
    return () => {
      clearTimeout(start)
      clearInterval(interval)
    }
  }, [text, speed, delay])

  return { displayed, done }
}

export default function App() {
  const [formData, setFormData] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState({})
  const [formOpen, setFormOpen] = useState(true)
  const { displayed: typedSubline, done: typingDone } = useTypewriter(frontmatter.subheadline)

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(({ open }) => setFormOpen(open))
      .catch(() => {})
  }, [])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' })
    }
  }

  const validate = () => {
    const next = {}
    frontmatter.fields.forEach((field) => {
      if (field.required && !formData[field.id]) {
        next[field.id] = 'campo obrigatório'
      }
      if (field.type === 'email' && formData[field.id]) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData[field.id])) {
          next[field.id] = 'email inválido'
        }
      }
    })
    return next
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const next = validate()
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error()
      setSubmitted(true)
    } catch {
      setErrors({ _global: 'erro ao enviar, tente novamente' })
    }
  }

  return (
    <div className={styles.page}>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <video className={styles.heroVideo} autoPlay muted loop playsInline>
            <source src="hero.webm" type="video/webm" />
            <source src="hero.mp4" type="video/mp4" />
          </video>
          <div className={styles.heroOverlay} />
        </div>

        {/* Occult triangle / eye — faint background art */}
        <svg className={styles.bgTriangle} viewBox="0 0 200 178" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M100 6L194 172H6L100 6Z" stroke="#00ff41" strokeWidth="0.6"/>
          <path d="M100 30L178 166H22L100 30Z" stroke="#00ff41" strokeWidth="0.3" strokeDasharray="3 6"/>
          <circle cx="100" cy="126" r="20" stroke="#00ff41" strokeWidth="0.6"/>
          <circle cx="100" cy="126" r="5" fill="rgba(0,255,65,0.2)"/>
          <ellipse cx="100" cy="126" rx="12" ry="7" stroke="#00ff41" strokeWidth="0.4"/>
          <line x1="100" y1="106" x2="100" y2="84" stroke="#00ff41" strokeWidth="0.4" strokeDasharray="2 3"/>
        </svg>

        <div className={styles.heroBadge}>[ FREQUÊNCIA RESTRITA // ORDEM OCULTA ]</div>

        <div className={styles.heroContent}>
          <img src={logoSvg} alt="OpenCDJ" className={styles.heroLogo} />
          <p className={styles.heroSubline}>
            <span className={styles.prompt}>&gt; </span>
            {typedSubline}
            <span className={`${styles.cursor} ${typingDone ? styles.cursorBlink : ''}`}>_</span>
          </p>
          <a href="#form" className={styles.heroCta}>
            <span className={styles.ctaArrow}>▶</span> {frontmatter.submitText}
          </a>
        </div>

        <div className={styles.heroStatusBar}>
          <span className={styles.statusDot}>◉</span>
          <span>SYS.ONLINE</span>
          <span className={styles.statusSep}>//</span>
          <span>ACESSO.RESTRITO</span>
          <span className={styles.statusSep}>//</span>
          <span>NODE.33</span>
          <span className={styles.statusSep}>//</span>
          <span>△</span>
        </div>

        <div className={styles.scrollIndicator}><span /></div>
      </section>

      {/* ── Section divider ── */}
      <div className={styles.divider} aria-hidden="true">
        <span>──────────────</span>
        <span className={styles.dividerSymbol}> △ </span>
        <span>──────────────</span>
      </div>

      {/* ── Form Section ── */}
      <section id="form" className={styles.formSection}>
        <div className={styles.formContainer}>
          <span className={styles.corner} data-pos="tl" />
          <span className={styles.corner} data-pos="tr" />
          <span className={styles.corner} data-pos="bl" />
          <span className={styles.corner} data-pos="br" />

          <div className={styles.formIntro}>
            <div className={styles.sectionTag}>// 01 · MANIFESTO</div>
            <h1 className={styles.headline}>{frontmatter.headline}</h1>
            <p className={styles.description}>{frontmatter.description}</p>
            <div className={styles.markdownBody}>
              <ReactMarkdown>{markdownBody}</ReactMarkdown>
            </div>
          </div>

          <div className={styles.sectionTag}>// 02 · INSCRIÇÃO</div>

          {!formOpen ? (
            <div className={styles.success}>
              <div className={styles.successIcon}>△</div>
              <p>// inscrições encerradas. fique ligado nas próximas edições.</p>
            </div>
          ) : submitted ? (
            <div className={styles.success}>
              <div className={styles.successIcon}>△</div>
              <p>{frontmatter.successMessage}</p>
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              {frontmatter.fields.map((field, i) => (
                <div key={field.id} className={styles.fieldGroup}>
                  <label htmlFor={field.id} className={styles.label}>
                    <span className={styles.fieldNum}>[{String(i + 1).padStart(2, '0')}]</span>
                    {field.label}
                    {field.required && <span className={styles.required}> *</span>}
                  </label>

                  {field.type === 'select' ? (
                    <select
                      id={field.id}
                      name={field.id}
                      className={`${styles.input} ${errors[field.id] ? styles.inputError : ''}`}
                      value={formData[field.id] || ''}
                      onChange={handleChange}
                    >
                      <option value="">selecione...</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={field.id}
                      name={field.id}
                      type={field.type}
                      placeholder={field.placeholder}
                      className={`${styles.input} ${errors[field.id] ? styles.inputError : ''}`}
                      value={formData[field.id] || ''}
                      onChange={handleChange}
                    />
                  )}

                  {errors[field.id] && (
                    <span className={styles.errorMsg}>! {errors[field.id]}</span>
                  )}
                </div>
              ))}

              {errors._global && (
                <span className={styles.errorMsg}>! {errors._global}</span>
              )}
              <button type="submit" className={styles.submitBtn}>
                <span>▶ {frontmatter.submitText}</span>
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerDivider} aria-hidden="true">
          △ △ △
        </div>
        <div className={styles.footerRow}>
          <a href="mailto:rz@bit-lab.tech" className={styles.footerEmail}>
            rz@bit-lab.tech
          </a>
          <span className={styles.footerSep}>//</span>
          <span className={styles.footerCopy}>© {new Date().getFullYear()} BIT LAB</span>
        </div>
        <div className={styles.footerCode} aria-hidden="true">
          01001111 01010010 01000100 01000101 01001101
        </div>
      </footer>

    </div>
  )
}
