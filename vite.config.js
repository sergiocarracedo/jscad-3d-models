import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        coasters: new URL('./coasters.html', import.meta.url).pathname,
      },
    },
  },
  server: {
    open: '/',
  },
})
