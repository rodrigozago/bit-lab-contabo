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

module.exports = { list, findBySlug, create, ensure, remove }
