import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// When deploying to GitHub Pages repository without custom domain, use '/hexboardgame.com' subpath.
// For local development ('npm run dev') and Cloudflare Pages / Custom Domain, use root '/'.
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true' && !process.env.CUSTOM_DOMAIN;

export default defineConfig({
  site: isGitHubPages ? 'https://utkarsh707.github.io' : 'https://hexboardgame.com',
  base: isGitHubPages ? '/hexboardgame.com' : '/',
  vite: {
    plugins: [tailwindcss()]
  }
});
