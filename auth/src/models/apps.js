const { pool } = require('../db')

async function list() {
  const { rows } = await pool.query('SELECT * FROM apps ORDER BY name ASC')
  return rows
}

async function findBySlug(slug) {
  const { rows } = await pool.query('SELECT * FROM apps WHERE slug = $1', [slug])
  return rows[0] || null
}

async function create({ slug, name }) {
  const { rows } = await pool.query(
    'INSERT INTO apps (slug, name) VALUES ($1, $2) RETURNING *',
    [slug, name]
  )
  return rows[0]
}

/** Cria o app se ainda não existir — usado no bootstrap para semear apps conhecidos. */
async function ensure({ slug, name }) {
  const { rows } = await pool.query(
    `INSERT INTO apps (slug, name) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [slug, name]
  )
  return rows[0]
}

async function remove(id) {
  await pool.query('DELETE FROM apps WHERE id = $1', [id])
}

/** Liga/desliga self-signup (`/signup?app=<slug>`) pra este app específico. */
async function setSelfSignup(id, allowed) {
  const { rows } = await pool.query(
    'UPDATE apps SET allow_self_signup = $2 WHERE id = $1 RETURNING *',
    [id, !!allowed]
  )
  return rows[0] || null
}

/** Liga/desliga termo próprio do app (além do termo global do cadastro) —
 * termsVersion null = app não exige termo próprio (comportamento padrão). */
async function setTerms(id, { termsVersion, termsUrl }) {
  const { rows } = await pool.query(
    'UPDATE apps SET terms_version = $2, terms_url = $3 WHERE id = $1 RETURNING *',
    [id, termsVersion || null, termsUrl || null]
  )
  return rows[0] || null
}

module.exports = { list, findBySlug, create, ensure, remove, setSelfSignup, setTerms }
