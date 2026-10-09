import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths so the build works from a GitHub Pages project subpath.
  base: './',
  plugins: [svelte()],
})
