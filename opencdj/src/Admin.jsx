import { useState, useEffect } from 'react'
import styles from './Admin.module.css'

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token'))
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (token) fetchSubmissions()
  }, [token])

  async function login(e) {
    e.preventDefault()
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      const { token: t } = await res.json()
      sessionStorage.setItem('admin_token', t)
      setToken(t)
      setLoginError('')
    } else {
      setLoginError('senha incorreta')
    }
  }

  async function fetchSubmissions() {
    setLoading(true)
    const res = await fetch('/api/admin/submissions', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      setSubmissions(await res.json())
    } else {
      sessionStorage.removeItem('admin_token')
      setToken(null)
    }
    setLoading(false)
  }

  async function deleteSubmission(id) {
    await fetch(`/api/admin/submissions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setSubmissions(prev => prev.filter(s => s.id !== id))
  }

  function logout() {
    sessionStorage.removeItem('admin_token')
    setToken(null)
  }

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.box}>
          <div className={styles.tag}>// ADMIN · BIT LAB</div>
          <form onSubmit={login} className={styles.form}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="senha"
              className={styles.input}
              autoFocus
            />
            {loginError && <span className={styles.error}>! {loginError}</span>}
            <button type="submit" className={styles.btn}>▶ ACESSAR</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.tag}>// INSCRIÇÕES · OPEN CDJ</span>
        <div className={styles.actions}>
          <button onClick={fetchSubmissions} className={styles.btnSm}>↺ ATUALIZAR</button>
          <button onClick={logout} className={styles.btnSm}>✕ SAIR</button>
        </div>
      </div>

      {loading ? (
        <p className={styles.info}>carregando...</p>
      ) : submissions.length === 0 ? (
        <p className={styles.info}>nenhuma inscrição ainda.</p>
      ) : (
        <>
          <p className={styles.count}>{submissions.length} inscrição(ões)</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>NOME</th>
                  <th>CONTATO</th>
                  <th>GÊNERO</th>
                  <th>DATA</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => (
                  <tr key={s.id}>
                    <td className={styles.id}>{s.id}</td>
                    <td>{s.name}</td>
                    <td>{s.contact}</td>
                    <td>{s.genre}</td>
                    <td className={styles.date}>{s.created_at}</td>
                    <td>
                      <button
                        onClick={() => deleteSubmission(s.id)}
                        className={styles.btnDel}
                        title="apagar"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
