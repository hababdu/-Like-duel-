import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import react from '@vitejs/plugin-react' // Agar React ishlatayotgan bo'lsangiz, bu satrni oching
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    // react(), // Agar React ishlatayotgan bo'lsangiz, bu satrni oching
    tailwindcss() , react()
  ],
})