import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
        open: true,
        strictPort: false,
        https: false,
        cors: true,
    },
    build: {
        rollupOptions: {
            input: {
                index: 'hero.html',
                app: 'index.html',
                format: 'format.html'
            }
        }
    },
})
