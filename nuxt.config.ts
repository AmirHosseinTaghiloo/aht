export default defineNuxtConfig({
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css', '~/assets/css/amt.css'],
  app: { head: { title: 'Amir Hossein Taghiloo — Frontend Developer', link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Caveat:wght@600&display=swap' }] } },
  compatibilityDate: '2024-11-01'
})
