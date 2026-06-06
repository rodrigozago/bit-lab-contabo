import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import matter from 'gray-matter'

function markdownFrontmatterPlugin() {
  return {
    name: 'vite-plugin-md-frontmatter',
    transform(src, id) {
      if (id.endsWith('.md')) {
        const { data, content } = matter(src)
        return {
          code: `export default ${JSON.stringify({ data, content })}`,
          map: null,
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [markdownFrontmatterPlugin(), react()],
  base: '/opencdj/',
})
