<script setup lang="ts">
const projects = [
  { n: '01', name: 'NEXORA', desc: 'Modern creative digital agency website with a futuristic design, smooth animations and a fully responsive layout.', tags: ['Vue.js', 'Nuxt.js', 'Tailwind CSS'], url: '#', g: 'from-indigo-900 via-purple-900 to-black', h: 'We build digital experiences that matter.' },
  { n: '02', name: 'ASA SHOP', desc: 'E-commerce website with a clean and modern design, built for a smooth shopping experience and high performance.', tags: ['Vue.js', 'Nuxt.js', 'TypeScript'], url: '#', g: 'from-orange-100 via-white to-orange-200', h: 'The Best Products For a Better Life', dark: true },
  { n: '03', name: 'Computer Store', desc: 'Modern online store for computer and gaming products, featuring a clean UI, powerful search and a seamless user experience.', tags: ['Nuxt.js', 'Tailwind CSS', 'TypeScript'], url: '#', g: 'from-blue-950 via-slate-900 to-black', h: 'Upgrade Your Setup, Upgrade Your Life' }
]
const skills = ['Vue.js', 'Nuxt.js', 'JavaScript', 'TypeScript', 'Tailwind CSS', 'Node.js', 'Figma', 'Git']
const stats = [['3+', 'Years Experience'], ['15+', 'Projects Completed'], ['∞', 'Cups of Coffee']]
const canvas = ref<HTMLCanvasElement>()
const label = ref('')
const menu = ref(false)

onMounted(() => {
  const root = document.documentElement
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  // scroll progress vars
  let sy = 0, last = 0, vel = 0
  const onScroll = () => {
    sy = scrollY
    const vh = innerHeight
    const home = document.getElementById('home')
    if (home) {
      const heroTravel = Math.max(1, home.offsetHeight - vh)
      root.style.setProperty('--hero', String(clamp((sy - home.offsetTop) / heroTravel)))
    }
    const pr = document.getElementById('projects')
    if (pr) root.style.setProperty('--proj', String(clamp((sy - pr.offsetTop) / Math.max(1, pr.offsetHeight - vh))))
    root.style.setProperty('--sy', String(sy))
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll()
  // reveal
  const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { threshold: .2 })
  document.querySelectorAll('.reveal').forEach(el => io.observe(el))
  // Cursor effects are only enabled on devices with a precise pointer.
  const dot = document.querySelector('.cur-dot') as HTMLElement, ring = document.querySelector('.cur-ring') as HTMLElement
  const desktopPointer = matchMedia('(pointer: fine)').matches
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my
  if (desktopPointer) {
    addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY }, { passive: true })
    document.addEventListener('mouseover', e => {
      const t = (e.target as HTMLElement).closest('[data-cur],[data-cursor]') as HTMLElement | null
      document.body.classList.toggle('hov', !!t); label.value = t?.dataset.cur || t?.dataset.cursor || ''
    })
  }
  // A lighter starfield on phones keeps scrolling smooth without changing desktop visuals.
  const c = canvas.value!, x = c.getContext('2d')!
  const mobileStars = () => matchMedia('(max-width: 767px), (pointer: coarse)').matches
  let starCount = 0
  let stars: { x: number; y: number; z: number }[] = []
  const resize = () => {
    c.width = innerWidth; c.height = innerHeight
    const count = mobileStars() ? 72 : 260
    if (count !== starCount) {
      starCount = count
      stars = Array.from({ length: count }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() * 2 + .2 }))
    }
  }
  resize(); addEventListener('resize', resize, { passive: true })
  const loop = () => {
    if (desktopPointer) {
      rx += (mx - rx) * .15; ry += (my - ry) * .15
      dot.style.transform = `translate(${mx}px,${my}px)`; ring.style.transform = `translate(${rx}px,${ry}px)`
    }
    vel += ((sy - last) - vel) * .1; last = sy
    x.clearRect(0, 0, c.width, c.height)
    for (const s of stars) {
      const drift = mobileStars() ? .00024 : .00015
      s.y = (s.y - (s.z * (drift + Math.abs(vel) * .0004)) + 1) % 1
      x.fillStyle = `rgba(255,${200 + s.z * 20},${160 + s.z * 30},${.3 + s.z * .3})`
      x.fillRect(s.x * c.width + (desktopPointer ? (mx - c.width / 2) * .01 * s.z : 0), s.y * c.height, s.z, s.z + Math.abs(vel) * s.z * .6)
    }
    requestAnimationFrame(loop)
  }; loop()
})
</script>

<template>
  <div>
    <div class="cur-dot" /><div class="cur-ring"><span>{{ label }}</span></div>
    <canvas ref="canvas" class="fixed inset-0 -z-10" />

    <!-- NAV -->
    <header class="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-12 py-5 backdrop-blur-sm">
      <b class="text-xl tracking-widest">◯ AHT</b>
      <nav class="hidden md:flex gap-8 text-sm text-white/70">
        <a href="#home" data-cur="GO">Home</a><a href="#about" data-cur="GO">About</a><a href="#skills" data-cur="GO">Skills</a><a href="#projects" data-cur="GO">Projects</a><a href="#contact" data-cur="GO">Contact</a>
      </nav>
      <a href="/Amir-Hossein-Taghiloo-Resume.pdf" download data-cur="PDF" class="hidden md:block border border-accent text-accent rounded-full px-5 py-2 text-sm hover:bg-accent hover:text-black transition"><i></i> Download Resume</a>
      <button class="md:hidden text-2xl" @click="menu = !menu" aria-label="Menu">{{ menu ? '✕' : '☰' }}</button>
      <nav v-if="menu" class="md:hidden absolute top-full inset-x-0 bg-black/90 backdrop-blur p-6 grid gap-4 text-lg" @click="menu = false"><a href="#about">About</a><a href="#skills">Skills</a><a href="#projects">Projects</a><a href="#contact">Contact</a><a href="/Amir-Hossein-Taghiloo-Resume.pdf" download class="text-accent">⬇ Download Resume</a></nav>
    </header>

    <!-- HERO (300vh pinned, planet zooms with scroll) -->
    <section id="home" class="relative h-[300vh]">
      <div class="sticky top-0 h-screen overflow-hidden">
        <div class="pat-grid absolute inset-0" style="opacity:calc(.9 - var(--hero,0)*1.2)" />
        <div class="pat-rings absolute left-1/2 top-1/2" style="transform:translate(-50%,-50%) scale(calc(1 + var(--hero,0)*2));opacity:calc(1 - var(--hero,0)*1.5)">
          <i class="r1" /><i class="r2" /><i class="r3" /><i class="r4" /><b class="d1" /><b class="d2" /><b class="d3" />
        </div>
        <div class="absolute left-1/2 top-1/2 w-[46vmin]" style="transform:translate(10vmin,-42vmin) translateY(calc(var(--hero,0)*-30vh)) scale(calc(1 + var(--hero,0)*1.5));opacity:calc(1 - var(--hero,0)*1.6)">
          <div class="saturn"><span class="ring back" /><span class="body" /><span class="ring front" /></div>
        </div>
        <div class="planet absolute rounded-full overflow-hidden left-1/2 top-1/2 w-[60vmin] h-[60vmin]"
          style="transform:translate(-50%,-50%) scale(calc(1 + var(--hero,0)*5)) rotate(calc(var(--hero,0)*60deg));opacity:calc(1 - var(--hero,0)*.7)" />
        <img src="/hero-portrait.png" alt="Amir Hossein Taghiloo"
          class="absolute bottom-0 rounded-full left-1/2 h-[88vh] max-w-none drop-shadow-[0_0_60px_rgba(255,106,26,.5)]"
          style="transform:translateX(-50%) translateY(calc(var(--hero,0)*40vh)) scale(calc(1 - var(--hero,0)*.25));opacity:calc(1 - var(--hero,0)*1.3)">
        <div class="absolute left-6 md:left-12 top-1/3 max-w-md" style="transform:translateY(calc(var(--hero,0)*-60vh));opacity:calc(1 - var(--hero,0)*2)">
          <p class="text-accent text-xs tracking-[.3em] mb-3">● HELLO, I'M</p>
          <h1 class="text-5xl md:text-7xl font-bold leading-none bg-gradient-to-b from-white to-orange-300 bg-clip-text text-transparent">Amir Hossein Taghiloo</h1>
          <p class="mt-4 text-lg">Frontend Developer • <span class="text-white/70">Vue / Nuxt</span></p>
          <p class="mt-3 text-sm text-white/60">I transform creative ideas into fast, immersive web experiences. Precise code. Bold ideas. Remarkable details.</p>
          <p class="mt-3 text-xs text-white/50"><i class="inline-block w-2 h-2 rounded-full bg-accent mr-2"></i>Available for new opportunities • Based in Tehran • Working worldwide</p>
          <div class="mt-6 flex flex-wrap gap-3">
            <a href="/Amir-Hossein-Taghiloo-Resume.pdf" download data-cur="PDF" class="border border-accent text-accent rounded-full px-6 py-3 hover:bg-accent hover:text-black transition">⬇ Download Resume</a>
            <a href="https://github.com/AmirHosseinTaghiloo" target="_blank" data-cur="GITHUB" class="btn-gh glass rounded-full px-6 py-3 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.200 1.8 1.200 1 1.800 2.800 1.300 3.400 1 .1-.8.4-1.300.8-1.600-2.600-.3-5.300-1.300-5.300-5.700 0-1.300.5-2.300 1.200-3.100-.1-.3-.5-1.500.1-3.100 0 0 1-.3 3.200 1.200a11 11 0 0 1 5.800 0c2.200-1.500 3.200-1.200 3.200-1.200.6 1.600.2 2.800.1 3.100.8.800 1.200 1.800 1.200 3.100 0 4.400-2.700 5.400-5.300 5.700.4.4.8 1.100.8 2.200v3.200c0 .3.2.7.8.6A11.500 11.500 0 0 0 12 .5z"/></svg>GitHub</a>
            <a href="https://www.linkedin.com/in/amir-taghiloo-605928248/" target="_blank" data-cur="LINKEDIN" class="btn-li glass rounded-full px-6 py-3 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.800v1.600h.1c.5-1 1.800-1.900 3.700-1.900 4 0 4.700 2.600 4.700 6V21h-4v-5.200c0-1.300 0-2.900-1.800-2.900s-2 1.400-2 2.800V21h-4z"/></svg>LinkedIn</a>
          </div>
        </div>
        <div class="absolute right-6 md:right-16 top-28 hidden md:block w-56 rounded-3xl overflow-hidden glass p-2" style="transform:translateY(calc(var(--hero,0)*-30vh)) rotate(calc(var(--hero,0)*12deg));opacity:calc(1 - var(--hero,0)*1.5)">
          <img src="/portrait-card.jpg" class="rounded-2xl" alt=""><p class="p-2 text-xs text-accent">◆ Creative Developer</p>
        </div>
        <p class="absolute bottom-6 right-8 text-[10px] tracking-[.3em] text-white/50 [writing-mode:vertical-rl]">SCROLL TO EXPLORE</p>
      </div>
    </section>

    <!-- STATS -->
    <section class="py-24 flex flex-wrap justify-center gap-16">
      <div v-for="s in stats" :key="s[1]" class="reveal text-center"><div class="text-6xl font-bold text-accent">{{ s[0] }}</div><div class="text-white/60 mt-2">{{ s[1] }}</div></div>
    </section>

    <CosmosSections />
  </div>
</template>
