// Animates every element on scroll + floating stars layers that live behind the whole site
export const useFx = () => onMounted(() => {
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches
  // ---------- floating stars (fixed, 3 parallax depths, seamless loop) ----------
  const colors = ['#fff', '#ffd9b0', '#ffb070', '#ffe9d2', '#ff8a3c']
  const layers = [{ d: .12, n: 60, s: 1.6 }, { d: .28, n: 36, s: 2.6 }, { d: .5, n: 16, s: 5 }].map(({ d, n, s }, li) => {
    const el = document.createElement('div'); el.className = 'star-layer'
    for (let k = 0; k < n; k++) {
      const x = Math.random() * 100, y = Math.random() * 50, size = (Math.random() * .7 + .5) * s
      const glyph = li === 2 && k % 2 === 0
      for (const off of [0, 50]) {
        const st = document.createElement('i'); st.className = 'fstar' + (glyph ? ' glyph' : '')
        if (glyph) st.textContent = '✦'
        st.style.cssText = `left:${x}%;top:${y + off}%;width:${size}px;height:${size}px;font-size:${size * 3}px;color:${colors[k % 5]};--c:${colors[k % 5]};--tw:${2 + Math.random() * 4}s;--fl:${6 + Math.random() * 9}s;--dly:-${Math.random() * 8}s`
        el.appendChild(st)
      }
    }
    document.body.prepend(el); return { el, d }
  })
  const moveStars = () => layers.forEach(({ el, d }) => { el.style.transform = `translate3d(0,${-((scrollY * d) % (innerHeight * 1))}px,0)` })
  addEventListener('scroll', moveStars, { passive: true }); moveStars()
  if (reduce) return
  // ---------- animate EVERYTHING ----------
  const SEL = 'h1,h2,h3,p,a,button,img,li,strong,small,em,b,i,span,article,label,.glass,.skill-tile,.contact-card,.quote-card,.browser-frame,.facts-strip>div'
  const EXC = '.star-layer,.cur-dot,.cur-ring,.planet,.saturn,.pat-grid,.pat-rings,.scroll-progress,.portal-torus,.about-mini-planet,.pulse-dot,svg,#preview-dialog,.effects-control'
  const fxs = ['f-rise', 'f-left', 'f-right', 'f-zoom', 'f-flip']
  const targets = [...document.querySelectorAll<HTMLElement>(SEL)].filter(el => !el.closest(EXC) && !el.hasAttribute('data-na')
    && !el.getAttribute('style')?.includes('opacity') && getComputedStyle(el).animationName === 'none')
  targets.forEach((el, n) => {
    const idx = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0
    el.style.setProperty('--fx', fxs[(n + idx) % fxs.length]); el.style.setProperty('--dl', Math.min(idx, 8) * .07 + 's')
    el.classList.add('fx-pre')
  })
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return
    const el = e.target as HTMLElement; io.unobserve(el); el.classList.add('fx')
    el.addEventListener('animationend', () => el.classList.remove('fx', 'fx-pre'), { once: true })
  }), { threshold: .12 })
  targets.forEach(el => io.observe(el))
  // ---------- count-up numbers ----------
  document.querySelectorAll<HTMLElement>('.reveal .text-6xl').forEach(el => {
    const m = el.textContent!.match(/^(\d+)(\+?)$/); if (!m) return
    const to = +m[1], o = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; o.disconnect(); const t0 = performance.now()
      const tick = (t: number) => { const p = Math.min(1, (t - t0) / 1600); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + m[2]; if (p < 1) requestAnimationFrame(tick) }; requestAnimationFrame(tick) })
    o.observe(el)
  })
})
