import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        }
    },
    build: {
        rollupOptions: {
            input: {
                index: 'index.html',
                hero: 'hero.html'
            }
        }
    }
})
