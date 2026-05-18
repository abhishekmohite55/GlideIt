import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

const isSingleFile = process.env.VITE_SINGLE_FILE === 'true'

export default defineConfig({
  plugins: [
    react(),
    isSingleFile && viteSingleFile()
  ].filter(Boolean),
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Ensure assets are in a predictable location
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})
