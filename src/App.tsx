import {
  useState,
  useEffect,
  useRef,
  ReactNode,
  CSSProperties,
  RefObject,
} from 'react';
import { Menu, X } from 'lucide-react';

// ── Math helpers ─────────────────────────────────────────────────────────────

const grow = (p: number, r: number, y: number) => p * Math.pow(1 + r, y);

const fmtM = (n: number): string =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${Math.round(n).toLocaleString()}`;

// ── In-view + count-up helpers ────────────────────────────────────────────────

// Fires once when the element first scrolls into view.
function useInView<T extends HTMLElement>(
  threshold = 0.3,
): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

// Smoothly tweens a number toward its target (counts up on reveal, eases on
// live changes). `active` gates the start so figures animate when scrolled in.
function CountUp({
  value,
  active,
  decimals = 0,
  prefix = '',
  suffix = '',
  money = false,
  duration = 1300,
  className,
  style,
}: {
  value: number;
  active: boolean;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  money?: boolean;
  duration?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const target = active ? value : 0;
  const [, force] = useState(0);
  const curRef = useRef(0);
  const rafRef = useRef(0);
  useEffect(() => {
    const from = curRef.current;
    const t0 = performance.now();
    cancelAnimationFrame(rafRef.current);
    const step = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      curRef.current = from + (target - from) * e;
      force(v => v + 1);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  const n = curRef.current;
  const text = money
    ? fmtM(n)
    : `${prefix}${n.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;
  return (
    <span className={className} style={style}>
      {text}
    </span>
  );
}

// ── FadeIn wrapper ────────────────────────────────────────────────────────────

function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVis(true);
      },
      { threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? 'translateY(0)' : 'translateY(22px)',
        transition: `opacity 1.1s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 1.1s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── Interactive honeycomb background ───────────────────────────────────────────
// A flat-top hexagon grid sized to a fixed viewBox and scaled to cover the hero.
// Each hexagon reacts to the cursor purely via CSS :hover (see index.css).

const HEX = (() => {
  const R = 64; // circumradius
  const hSpacing = 1.5 * R;
  const vSpacing = Math.sqrt(3) * R;
  const VBW = 1440;
  const VBH = 1024;
  const cols = Math.ceil(VBW / hSpacing) + 2;
  const rows = Math.ceil(VBH / vSpacing) + 2;
  const points = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i);
      return `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  const list: { k: string; p: string; gray: boolean }[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cx = c * hSpacing;
      const cy = r * vSpacing + (c % 2 ? vSpacing / 2 : 0);
      list.push({ k: `${c}-${r}`, p: points(cx, cy), gray: (c * 7 + r * 13) % 17 < 3 });
    }
  }
  return { VBW, VBH, list };
})();

function HexBackground() {
  return (
    <svg
      className="hex-bg"
      viewBox={`0 0 ${HEX.VBW} ${HEX.VBH}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {HEX.list.map(h => (
        <polygon key={h.k} points={h.p} className={`hex${h.gray ? ' hex--gray' : ''}`} />
      ))}
    </svg>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [investment, setInvestment] = useState(100_000);
  const [years, setYears] = useState(5);
  const [heroCount, setHeroCount] = useState(0);
  const [formSent, setFormSent] = useState(false);
  const [formSending, setFormSending] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 70);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    let raf: number;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min((t - t0) / 2200, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setHeroCount(Math.floor(25 * ease));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(step);
    }, 400);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Sticky "stacking cards" — each panel pins, the next slides up and over it.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const panels = Array.from(
      document.querySelectorAll<HTMLElement>('.stack-panel'),
    );
    if (panels.length === 0) return;
    panels.forEach((p, i) => {
      p.style.zIndex = String(i + 1);
    });

    // Panels taller than the viewport get a negative `top` so all their
    // content scrolls into view before they pin at the bottom edge.
    const setTops = () => {
      const H = window.innerHeight;
      panels.forEach(p => {
        const h = p.offsetHeight;
        p.style.top = h > H ? `${H - h}px` : '0px';
      });
    };

    let raf = 0;
    const render = () => {
      raf = 0;
      const H = window.innerHeight;
      for (let i = 0; i < panels.length; i++) {
        const cur = panels[i];
        const next = panels[i + 1];
        const dim = cur.querySelector<HTMLElement>('.stack-dim');
        if (!next) {
          cur.style.transform = '';
          if (dim) dim.style.opacity = '0';
          continue;
        }
        // 0 → next panel just entering at the bottom; 1 → fully covering.
        const cover = Math.min(
          Math.max(1 - next.getBoundingClientRect().top / H, 0),
          1,
        );
        cur.style.transform = `scale(${1 - 0.04 * cover})`;
        if (dim) dim.style.opacity = `${0.55 * cover}`;
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };
    const onResize = () => {
      setTops();
      onScroll();
    };

    setTops();
    render();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('load', onResize);
    // Re-measure when the web fonts actually arrive — panel heights shift with
    // the swap, and stale `top` offsets make the pinning feel off.
    document.fonts?.ready.then(onResize).catch(() => {});
    const settle = window.setTimeout(onResize, 600); // fallback settle pass
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('load', onResize);
      window.clearTimeout(settle);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Hero bull: holds still on a rich standing frame while the hero is at rest,
  // and gallops only while you scroll — the stage also glides left (and eases
  // back) on a two-way rAF loop instead of snapping 1:1 with scrollY. Position
  // uses `left` (not transform) so the stage never gets a stacking context,
  // which would break the video's screen-blend against the hexagons (see CSS).
  //
  // While galloping, playback stays inside the clip's clean segment, measured
  // frame by frame: before ~1.5s the bull rides the right crop edge, past ~5.4s
  // the left; 5.0s is the deep-gold standing pose it rests on. The silhouette
  // mask (see CSS) hugs the bull across that whole window, so there is no crop
  // rectangle to show. Playback is started inside the scroll handler, so the
  // scroll gesture itself satisfies mobile autoplay — no muted-autoplay needed.
  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>('.bull-stage video');
    const stage = document.querySelector<HTMLElement>('.bull-stage');
    const hero = document.getElementById('hero');
    if (!video || !stage) return;

    // On mobile the bull is the static fallback image — keep it perfectly still
    // (no scroll-driven leftward run); just let the gentle idle glint sweep.
    const isMobile = window.matchMedia(
      '(hover: none) and (pointer: coarse), (max-width: 820px)',
    ).matches;
    if (isMobile) {
      stage.style.left = '0px';
      hero?.classList.add('is-idle');
      return;
    }

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    video.pause(); // still until the first scroll
    let hasScrolled = false;

    const PLAY_FROM = 1.5; // bull fully inside the crop from here…
    const PLAY_TO = 5.4; // …until here
    const IDLE_T = 5.0; // rich standing frame — the resting hero pose
    // Mobile browsers won't paint a <video> that has never played — a paused
    // seek alone leaves the bull invisible on phones (and forever so if Reduce
    // Motion is on, since scrolling then never plays it). So play it muted for
    // an instant to decode a frame, then pause straight back on the idle pose:
    // one still frame, no visible gallop, reduce-motion safe.
    const showIdleFrame = () => {
      video.currentTime = IDLE_T;
      const p = video.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          if (!hasScrolled) {
            video.pause();
            video.currentTime = IDLE_T;
          }
        }).catch(() => {});
      }
    };
    if (video.readyState >= 1) showIdleFrame();
    else video.addEventListener('loadedmetadata', showIdleFrame, { once: true });

    const targetX = () =>
      -Math.min(Math.max(window.scrollY / window.innerHeight, 0), 1) *
      window.innerWidth *
      0.5;
    // Pinned hero is fully buried once the next panel has scrolled one
    // viewport; past that nothing here can be seen, so nothing should run.
    const heroVisible = () => window.scrollY < window.innerHeight;

    let cur = targetX();
    stage.style.left = `${cur.toFixed(2)}px`;

    let raf = 0;
    let lastT = 0;
    let lastScrollAt = 0;
    let idleOn = false;
    const setIdle = (on: boolean) => {
      if (on === idleOn) return;
      idleOn = on;
      hero?.classList.toggle('is-idle', on); // gates only the wordmark glint
    };

    const tick = (now: number) => {
      const dt = Math.min(now - lastT || 16.7, 64);
      lastT = now;
      const target = targetX();
      const d = target - cur;
      // Exponential ease (~120ms time constant), frame-rate independent.
      cur = Math.abs(d) < 0.3 ? target : cur + d * (1 - Math.exp(-dt / 120));
      stage.style.left = `${cur.toFixed(2)}px`;

      // Keep the gallop inside the clean segment, carrying the overshoot.
      if (!video.paused && video.currentTime >= PLAY_TO) {
        video.currentTime = PLAY_FROM + (video.currentTime - PLAY_TO);
      }

      // Settled and not scrolling → freeze the bull where it stands, let the
      // wordmark glint sweep, and stop the loop until the next scroll.
      if (cur === target && now - lastScrollAt > 160) {
        video.pause();
        setIdle(heroVisible());
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf) {
        lastT = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const onScroll = () => {
      lastScrollAt = performance.now();
      hasScrolled = true;
      if (reduceMotion) {
        cur = targetX();
        stage.style.left = `${cur.toFixed(2)}px`;
        return;
      }
      setIdle(false); // moving → rest the wordmark glint, run the bull
      if (video.paused && heroVisible()) {
        // Re-base only when frozen too close to the segment's end to gallop
        // (or outside it); the jump hides inside the onset of motion.
        if (video.currentTime < PLAY_FROM || video.currentTime > PLAY_TO - 1.2) {
          video.currentTime = PLAY_FROM;
        }
        video.play().catch(() => {});
      }
      wake();
    };
    const onResize = () => {
      if (reduceMotion) {
        cur = targetX();
        stage.style.left = `${cur.toFixed(2)}px`;
        return;
      }
      wake();
    };

    setIdle(heroVisible()); // still on load → wordmark glint sweeps
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const gmVal = grow(investment, 0.25, years);
  const spVal = grow(investment, 0.1, years);
  const savVal = grow(investment, 0.02, years);
  const chartN = Math.min(years, 15);
  const chartVals = Array.from({ length: chartN }, (_, i) =>
    grow(investment, 0.25, i + 1),
  );
  const chartPeak = Math.max(...chartVals, 1);

  // Reveal triggers for the count-up figures
  const [statsRef, statsInView] = useInView<HTMLDivElement>(0.35);
  const [calcRef, calcInView] = useInView<HTMLSpanElement>(0.2);

  const navLinks = [
    { href: '#about', label: 'About' },
    { href: '#calculator', label: 'Performance' },
    { href: '#team', label: 'Our Team' },
    { href: '#contact', label: 'Contact' },
  ];

  const partners = [
    {
      name: 'Cristian Griep',
      role: 'Co-Founder',
      photo: '/assets/cristian-griep.jpg',
      bio: "A seasoned investment strategist with deep expertise in quantitative market analysis and global capital markets. Cristian's analytical rigor and disciplined approach to risk management have been instrumental in the fund's consistent outperformance over 8 years. He brings refined and extensive knowledge of financial and economic systems to deliver alpha for clients.",
    },
    {
      name: 'Paulo Mendes',
      role: 'Chief Executive Officer & COO',
      photo: '/assets/paulo-mendes.jpg',
      bio: "With extensive experience across capital markets and investment strategy, Paulo brings a global perspective and a refined approach to identifying alpha opportunities. His leadership and long-term vision continue to drive the fund's exceptional results. Focused on long-term consistency, effective risk management, and an in-depth analysis of market cycles.",
    },
  ];

  return (
    <div className="bg-[#080808] text-[#d8cdb8]">

      {/* ── NAVBAR ──────────────────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-7 md:px-[70px] transition-all duration-[400ms] ${
          scrolled
            ? 'py-4 bg-[#080808]/96 backdrop-blur-md border-b border-[#c9a84c]/20'
            : 'py-[22px]'
        }`}
      >
        <a href="#hero" className="flex items-center gap-3.5">
          <img src="/assets/bull.png" alt="" className="h-9 w-auto" />
          <div>
            <span className="block text-[13px] font-bold tracking-[3.5px] text-white uppercase">
              Griep Mendes
            </span>
            <span className="block text-[8px] font-light tracking-[7px] text-[#c9a84c] uppercase">
              Investments
            </span>
          </div>
        </a>

        <ul className="hidden lg:flex list-none gap-[42px] m-0 p-0">
          {navLinks.map(l => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-[10px] font-medium tracking-[2.5px] uppercase text-[#d8cdb8] hover:text-[#c9a84c] transition-colors duration-300"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4">
          <a
            href="#contact"
            className="hidden sm:block border border-[#c9a84c] text-[#c9a84c] px-[26px] py-[10px] text-[10px] font-semibold tracking-[2.5px] uppercase hover:bg-[#c9a84c] hover:text-[#080808] transition-all duration-300"
          >
            Book a Meeting
          </a>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="lg:hidden relative w-10 h-10 flex items-center justify-center text-white"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <Menu
              className={`w-5 h-5 absolute transition-all duration-300 ${
                menuOpen
                  ? 'opacity-0 rotate-90 scale-50'
                  : 'opacity-100 rotate-0 scale-100'
              }`}
            />
            <X
              className={`w-5 h-5 absolute transition-all duration-300 ${
                menuOpen
                  ? 'opacity-100 rotate-0 scale-100'
                  : 'opacity-0 -rotate-90 scale-50'
              }`}
            />
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-opacity duration-300 ${
          menuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMenuOpen(false)}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      </div>

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed top-0 right-0 bottom-0 z-50 w-[85%] max-w-sm bg-[#0f0f0f] border-l border-[#252525] shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full pt-24 px-8 pb-8">
          <div className="flex flex-col gap-0">
            {navLinks.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={`text-2xl font-semibold text-white py-4 border-b border-[#252525] uppercase tracking-[3px] transition-all duration-500 ${
                  menuOpen
                    ? 'translate-x-0 opacity-100'
                    : 'translate-x-8 opacity-0'
                }`}
                style={{
                  transitionDelay: menuOpen ? `${150 + i * 70}ms` : '0ms',
                }}
              >
                {l.label}
              </a>
            ))}
          </div>
          <div
            className={`mt-8 transition-all duration-500 ${
              menuOpen
                ? 'translate-x-0 opacity-100'
                : 'translate-x-8 opacity-0'
            }`}
            style={{ transitionDelay: menuOpen ? '400ms' : '0ms' }}
          >
            <a
              href="#contact"
              onClick={() => setMenuOpen(false)}
              className="btn-lux block text-center bg-[#c9a84c] text-[#080808] py-4 text-[10px] font-semibold tracking-[3px] uppercase hover:bg-[#d8bd72]"
            >
              Book a Meeting
            </a>
          </div>
        </div>
      </div>

      {/* ═══════════ STACKING SECTIONS ═══════════ */}
      <div className="stack">

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section
        id="hero"
        data-stack
        className="stack-panel relative min-h-screen flex items-center justify-center overflow-hidden bg-[#080808]"
      >
        {/* ── Interactive honeycomb — hexes light up gold as the cursor passes ── */}
        <HexBackground />
        {/* Anchor the top under the navbar and the base to black so the panel
            fades cleanly into the next section (pointer-events off so the
            hexagons stay fully interactive underneath). */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(8,8,8,0.55) 0%, transparent 20%, transparent 66%, #080808 100%)',
          }}
        />

        <div className="relative text-center max-w-[960px] px-6 sm:px-10 pointer-events-none">
          {/* Animated bull cut from the video (screen-blended onto the hexagons),
              charging in big and to the left, beside a larger wordmark. */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-9 mb-[38px]">
            <div className="bull-stage w-[clamp(200px,38vw,400px)] shrink-0">
              <video
                src="/assets/bull-run.mp4"
                poster="/assets/bull-idle.jpg"
                muted
                loop
                playsInline
                preload="auto"
              />
              {/* iOS Safari renders <video> in a separate layer that ignores
                  BOTH mix-blend-mode and mask-image, so the video's dark crop
                  window shows as a square no matter what. On touch devices we
                  drop the video entirely and show the transparent bull cut-out
                  (a plain <img> needs no blend or mask — never a box). It still
                  slides left on scroll via the stage's `left` offset. */}
              <img className="bull-fallback" src="/assets/bull.png" alt="Griep Mendes bull" />
            </div>
            <div className="relative text-center sm:text-left">
              <div
                className="glint-text glint-text--main font-bold uppercase"
                style={{
                  fontSize: 'clamp(40px, 7.6vw, 92px)',
                  letterSpacing: '0.05em',
                  lineHeight: 0.9,
                }}
              >
                Griep
                <br />
                Mendes
              </div>
              <div
                className="glint-text glint-text--sub font-light uppercase mt-2 sm:mt-3"
                style={{ fontSize: 'clamp(11px, 1.9vw, 20px)', letterSpacing: '0.5em' }}
              >
                Investments
              </div>
            </div>
          </div>

          <p
            className="text-[11px] sm:text-[13px] font-medium tracking-[6px] sm:tracking-[8px] text-[#c9a84c] uppercase mb-[44px]"
            style={{ textShadow: '0 2px 14px rgba(0,0,0,0.7)' }}
          >
            Where Capital Meets Conviction
          </p>

          {/* CTAs */}
          <div className="flex gap-[18px] justify-center flex-wrap pointer-events-auto">
            <a
              href="#contact"
              className="btn-lux inline-block bg-[#c9a84c] text-[#080808] px-[44px] py-4 text-[10px] font-semibold tracking-[3px] uppercase hover:bg-[#d8bd72]"
            >
              Book a Meeting
            </a>
            <a
              href="#calculator"
              className="btn-lux inline-block border border-[#c9a84c]/40 text-[#efe7d4] px-[44px] py-4 text-[10px] font-medium tracking-[3px] uppercase hover:border-[#c9a84c] hover:text-[#c9a84c]"
            >
              See Your Growth
            </a>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-[38px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[8px] tracking-[4px] uppercase text-[#706858] pointer-events-none">
          <div className="w-px h-11 bg-gradient-to-b from-[#c9a84c] to-transparent animate-pulse" />
          <span>Scroll</span>
        </div>

        <div className="stack-dim" />
      </section>

      {/* ── STATS / BY THE NUMBERS ──────────────────────────────────────── */}
      <section
        data-stack
        className="stack-panel bg-[#141414] flex items-center py-[80px] px-7 md:px-[70px]"
      >
        <div className="max-w-[1200px] mx-auto w-full">
          <div className="text-center mb-[56px]">
            <p className="text-[9.5px] font-semibold tracking-[5.5px] text-[#c9a84c] uppercase mb-[18px]">
              By the Numbers
            </p>
            <h2
              className="serif text-[#efe7d4]"
              style={{ fontSize: 'clamp(34px, 5vw, 60px)', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1.05 }}
            >
              A Track Record of{' '}
              <em className="text-[#c9a84c]" style={{ fontWeight: 600 }}>Results</em>
            </h2>
            <div className="w-[64px] h-px bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent mx-auto mt-[22px]" />
          </div>
          <div
            ref={statsRef}
            className="grid grid-cols-2 lg:grid-cols-4 divide-x-0 lg:divide-x divide-[#c9a84c]/10"
          >
          {[
            { value: 25, suffix: '%', decimals: 0, lbl: 'Avg. Annual Return' },
            { value: 8, suffix: '', decimals: 0, lbl: 'Years Track Record' },
            { value: 496, suffix: '%', decimals: 0, lbl: 'Total 8-Year Return' },
            { value: 5.96, suffix: '×', decimals: 2, lbl: 'Capital Multiplier' },
          ].map((s, i) => (
            <FadeIn
              key={i}
              delay={i * 120}
              className="text-center py-5 px-2.5 border-b lg:border-b-0 border-[#c9a84c]/10 last:border-b-0"
            >
              <CountUp
                value={s.value}
                active={statsInView}
                decimals={s.decimals}
                suffix={s.suffix}
                duration={1500}
                className="serif text-[#c9a84c] mb-1 block"
                style={{ fontSize: 'clamp(46px, 5.5vw, 62px)', fontWeight: 600, lineHeight: 1 }}
              />
              <div className="text-[9.5px] font-medium tracking-[3px] text-[#706858] uppercase">
                {s.lbl}
              </div>
            </FadeIn>
          ))}
          </div>
          <p className="text-center text-[10px] tracking-[1px] text-[#706858]/80 mt-[42px] italic">
            Past performance is not a guarantee of future results.
          </p>
        </div>

        <div className="stack-dim" />
      </section>

      {/* ── CALCULATOR ──────────────────────────────────────────────────── */}
      <section
        id="calculator"
        data-stack
        className="stack-panel py-[120px] bg-[#080808] flex items-center"
      >
        <div className="max-w-[1200px] mx-auto px-7 md:px-[70px] w-full">
          <FadeIn className="text-center mb-[70px]">
            <p className="text-[9.5px] font-semibold tracking-[5.5px] text-[#c9a84c] uppercase mb-[18px]">
              Growth Simulator
            </p>
            <h2
              className="serif text-[#efe7d4] mb-[18px]"
              style={{ fontSize: 'clamp(34px, 5vw, 60px)', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1.05 }}
            >
              What Could Your Money
              <br />
              <em className="text-[#c9a84c]" style={{ fontWeight: 600 }}>Have Become?</em>
            </h2>
            <div className="w-[64px] h-px bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent mx-auto mb-[22px]" />
            <p className="text-[13px] font-light text-[#706858] tracking-[1px] leading-[1.9] max-w-[500px] mx-auto">
              See the compounding difference that disciplined fund management
              makes over time.
            </p>
          </FadeIn>

          <FadeIn className="bg-[#141414] border border-[#252525] p-9 md:p-[60px]">
            {/* Amount slider */}
            <span
              ref={calcRef}
              className="block text-[10px] font-semibold tracking-[3px] uppercase text-[#706858] mb-4"
            >
              Initial Investment Amount
            </span>
            <div
              className="serif text-[#c9a84c] mb-[18px] leading-none tabular-nums"
              style={{ fontSize: 'clamp(42px, 6.6vw, 66px)', fontWeight: 600 }}
            >
              ${investment.toLocaleString()}
            </div>
            <input
              type="range"
              min={50000}
              max={1_000_000}
              step={5000}
              value={investment}
              onChange={e => setInvestment(Number(e.target.value))}
              className="w-full mb-3"
            />
            <div className="flex justify-between text-[9px] text-[#706858] tracking-[1px] mb-2.5">
              <span>$50K</span>
              <span>$350K</span>
              <span>$700K</span>
              <span>$1M</span>
            </div>
            <p className="text-[9.5px] tracking-[1.5px] uppercase text-[#c9a84c]/80 mb-7">
              Minimum investment — $50,000
            </p>

            {/* Year selector */}
            <span className="block text-[10px] font-semibold tracking-[3px] uppercase text-[#706858] mb-4">
              Investment Period
            </span>
            <div className="flex gap-2.5 flex-wrap mb-10">
              {[1, 3, 5, 10, 15].map(y => (
                <button
                  key={y}
                  onClick={() => setYears(y)}
                  className={`flex-1 min-w-[56px] py-3 px-2 text-[11px] font-semibold tracking-[1px] border transition-all duration-300 ${
                    years === y
                      ? 'bg-[#c9a84c] border-[#c9a84c] text-[#080808]'
                      : 'bg-transparent border-[#252525] text-[#706858] hover:border-[#c9a84c] hover:text-[#c9a84c]'
                  }`}
                >
                  {y === 1 ? '1 Yr' : `${y} Yrs`}
                </button>
              ))}
            </div>

            {/* Result cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
              {[
                { label: 'Savings Account', rate: '~2% per year', val: savVal, featured: false },
                { label: 'Our Performance', rate: '25% avg. per year', val: gmVal, featured: true },
                { label: 'S&P 500 Index', rate: '~10% avg. per year', val: spVal, featured: false },
              ].map(c => (
                <div
                  key={c.label}
                  className={`relative text-center p-7 border transition-colors duration-300 ${
                    c.featured
                      ? 'border-[#c9a84c] bg-[rgba(201,168,76,0.05)]'
                      : 'border-[#252525] bg-[#0f0f0f]'
                  }`}
                >
                  {c.featured && (
                    <div className="absolute -top-[11px] left-1/2 -translate-x-1/2 bg-[#c9a84c] text-[#080808] text-[8px] font-black tracking-[2px] px-3 py-1 whitespace-nowrap">
                      GRIEP MENDES
                    </div>
                  )}
                  <div className="text-[9px] font-bold tracking-[2px] text-[#706858] uppercase mb-1.5">
                    {c.label}
                  </div>
                  <div className="text-[12px] font-light text-[#706858] mb-3.5">{c.rate}</div>
                  <CountUp
                    value={c.val}
                    active={calcInView}
                    money
                    duration={1100}
                    className={`serif mb-1.5 tabular-nums block ${
                      c.featured ? 'text-[#c9a84c]' : 'text-[#efe7d4]'
                    }`}
                    style={{ fontSize: 'clamp(32px, 3.6vw, 42px)', fontWeight: 600, lineHeight: 1 }}
                  />
                  <div className="text-[11px] font-medium text-[#7faf7a] tracking-[0.5px]">
                    +{fmtM(c.val - investment)} gain
                  </div>
                </div>
              ))}
            </div>

            {/* Disclosure */}
            <p className="text-center text-[10px] tracking-[2.5px] uppercase text-[#c9a84c]/75 mt-8">
              ◆&nbsp;&nbsp;Past results do not guarantee future results&nbsp;&nbsp;◆
            </p>

            {/* Growth chart */}
            <div className="mt-12">
              <div className="text-[9.5px] font-semibold tracking-[3px] text-[#706858] uppercase mb-6">
                Year-by-Year Growth at 25% Annual Return
              </div>
              <div className="flex items-end gap-1 sm:gap-1.5 h-[180px] pb-8 border-b border-[#252525]">
                {chartVals.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center h-full justify-end"
                  >
                    <div
                      className="w-full bg-gradient-to-t from-[#8f6f22] to-[#c9a84c] min-h-[4px]"
                      style={{
                        height: calcInView ? `${Math.max((v / chartPeak) * 82, 3)}%` : '0%',
                        transition: 'height 0.9s cubic-bezier(0.22,1,0.36,1)',
                        transitionDelay: `${i * 60}ms`,
                      }}
                    />
                    <div className="text-[6px] sm:text-[7px] text-[#706858] text-center mt-1.5 leading-[1.3]">
                      Y{i + 1}
                      <br />
                      <span className="text-[5px] sm:text-[6px]">{fmtM(v)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[9.5px] text-[#706858] mt-5 leading-[1.7] tracking-[0.4px]">
              * This simulator is for illustrative purposes only. Past
              performance is not indicative of future results. The 25% figure
              represents the fund's historical average annual return over 8
              years. All investments carry risk.
            </p>
          </FadeIn>
        </div>

        <div className="stack-dim" />
      </section>

      {/* ── ABOUT ───────────────────────────────────────────────────────── */}
      <section
        id="about"
        data-stack
        className="stack-panel py-[120px] bg-[#0b110c] relative overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            background:
              'repeating-conic-gradient(rgba(201,168,76,1) 0% 25%, transparent 0% 50%) 0 0/22px 22px',
          }}
        />
        {/* Deep hunter-green glow — the old-money secondary, paired with gold */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 12%, rgba(36,64,42,0.55) 0%, transparent 62%), radial-gradient(ellipse 60% 50% at 50% 100%, rgba(24,46,30,0.5) 0%, transparent 60%)',
          }}
        />
        <div className="max-w-[1200px] mx-auto px-7 md:px-[70px] relative z-10">

          {/* About Us — intro */}
          <FadeIn className="text-center max-w-[880px] mx-auto mb-[96px]">
            <p className="text-[9.5px] font-semibold tracking-[5.5px] text-[#c9a84c] uppercase mb-[18px]">
              About Us
            </p>
            <h2
              className="serif text-[#efe7d4] mb-[22px]"
              style={{ fontSize: 'clamp(36px, 5.2vw, 64px)', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1.04 }}
            >
              A New Way of{' '}
              <em className="text-[#c9a84c]" style={{ fontWeight: 600 }}>Thinking</em>
            </h2>
            <div className="w-[64px] h-px bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent mx-auto mb-[28px]" />
            <p className="text-[13.5px] font-light text-[#a59a85] leading-[2.05] tracking-[0.4px]">
              Griep Mendes Investments is a new way of thinking when it comes to
              investing. Our mission is to consistently generate alpha in global
              markets across a range of conditions, with the discipline to manage
              risk effectively. We are a private investment fund with a unique,
              long-term view on investments — delivering exceptional service and
              building relationships with our clients centered around transparency
              and a shared state of mind that, in turn, elevates their level of
              success. Our services are backed by a growth mindset where no idea is
              inappropriate, as we strive for a level of excellence by carrying out
              our core principles and values.
            </p>
          </FadeIn>

          {/* Our Mission — centerpiece */}
          <FadeIn>
            <div className="text-center py-[70px] border-y border-[#252525] mb-[90px]">
              <h3
                className="serif text-[#efe7d4] mb-[26px]"
                style={{ fontSize: 'clamp(30px, 4.2vw, 50px)', fontWeight: 500, letterSpacing: '0.01em' }}
              >
                Our <em className="text-[#c9a84c]" style={{ fontWeight: 600 }}>Mission</em>
              </h3>
              <p
                className="serif text-[#cabd9f] max-w-[860px] mx-auto"
                style={{ fontSize: 'clamp(19px, 2.1vw, 26px)', fontStyle: 'italic', fontWeight: 400, lineHeight: 1.6 }}
              >
                Our mission is supported by an attitude that allows us to envision
                an array of creative possibilities from an idealistic perception,
                while using real-world methods to achieve them. Together, these
                contrasting abilities work hand in hand to efficiently deliver
                innovative investment opportunities to our clients with risk under
                control. Our team analyzes trends in the global market to extract
                data that allows us to develop action plans around realistic
                procedures — applying our talent and years of expertise to
                contribute to eminent returns. Quantitative research lets us
                analyze hard statistics and predict the most beneficial trends for
                the future, establishing long-term plans for our customers.
              </p>
            </div>
          </FadeIn>

          {/* Culture / What We Do / Who We Are */}
          <div className="flex flex-col">
            {[
              {
                num: '01',
                label: 'Culture',
                body: 'Our culture is to work smart and hard, with creativity and efficiency based on results, always focusing on the great investment opportunities the market can offer. We make sure we fully understand the inner workings of the global community and continuously evolve to stay parallel with the ways of the world. With the refined and extensive knowledge we hold of financial and economic systems, we implement valuable techniques to deliver alpha for our clients. We have deep experience in the industry and know what works in terms of professional analysis that cultivates results.',
              },
              {
                num: '02',
                label: 'What We Do',
                body: 'At Griep Mendes Investments we seek to obtain great results and performance through diverse strategies, always looking from a long-term perspective. We hire the best individuals — with dedication, intelligence, integrity, and team spirit, backed by a powerful work ethic — and our team is dedicated to providing a beneficial experience for the client. Our research methods are inspired by a diverse set of fields built on a unified set of underlying principles, and our overall goal is to build compelling, repeatable investments that are highly diversified across signals and regions, within a risk-controlled framework. These strategies differentiate themselves by recognizing the inherent risks and opportunities that come with global equity investing — pairing our Enhanced Strategy with a relentless dedication to finding alpha opportunities.',
              },
              {
                num: '03',
                label: 'Who We Are',
                body: 'We are a team of excellent investors who help people discover how profitable investing in the stock market can be. Aware of the risks of the market, with a focused team and a high level of humility and leadership, our effort is to maintain great results with a long-term vision — focused on creating profitable, long-lasting returns with risk under control. Our service is a leading force developed from years of experience, establishing us as a firm unlike any other, built on the values of long-term consistency, effective risk management, specialization, bottom-up analysis, and an in-depth understanding of market cycles. These contribute to excellence in investing and a responsible, distinguished approach entirely based around the goals of the customer. We have an extensive background investing across capital markets, and because of this we have expanded our services around a diversified pick of global capital investment strategies.',
              },
            ].map((b, i) => (
              <FadeIn key={b.label} delay={i * 80}>
                <div
                  className={`grid lg:grid-cols-[280px_1fr] gap-6 lg:gap-[60px] py-[48px] ${
                    i > 0 ? 'border-t border-[#252525]' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className="serif text-[rgba(201,168,76,0.3)] leading-none"
                      style={{ fontSize: '40px', fontWeight: 500, fontStyle: 'italic' }}
                    >
                      {b.num}
                    </span>
                    <h3
                      className="serif text-[#efe7d4] pt-1"
                      style={{ fontSize: 'clamp(26px, 3vw, 38px)', fontWeight: 500, letterSpacing: '0.01em' }}
                    >
                      {b.label}
                    </h3>
                  </div>
                  <p className="text-[13px] font-light text-[#8c8270] leading-[2.05] tracking-[0.3px]">
                    {b.body}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>

        <div className="stack-dim" />
      </section>

      {/* ── TEAM ────────────────────────────────────────────────────────── */}
      <section
        id="team"
        data-stack
        className="stack-panel py-[120px] px-7 md:px-[70px] bg-[#080808] flex items-center"
      >
        <div className="max-w-[1200px] mx-auto w-full">
          <FadeIn className="text-center mb-[68px]">
            <p className="text-[9.5px] font-semibold tracking-[5.5px] text-[#c9a84c] uppercase mb-[18px]">
              The People Behind the Performance
            </p>
            <h2
              className="serif text-[#efe7d4] mb-[18px]"
              style={{ fontSize: 'clamp(36px, 5.2vw, 64px)', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1.04 }}
            >
              Meet Our{' '}
              <em className="text-[#c9a84c]" style={{ fontWeight: 600 }}>Partners</em>
            </h2>
            <div className="w-[64px] h-px bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent mx-auto mb-[18px]" />
            <p className="text-[13px] font-light text-[#706858] tracking-[1px] leading-[1.9]">
              Two seasoned investors. One shared vision.
            </p>
          </FadeIn>

          <div className="grid lg:grid-cols-2 gap-9">
            {partners.map((person, i) => (
              <FadeIn key={i} delay={i * 150}>
                <div className="flex flex-col sm:flex-row gap-8 bg-[#121212] border border-[#252525] p-[38px] hover:border-[#c9a84c]/70 hover:bg-[#151515] transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group">
                  <div className="w-full sm:w-[190px] h-[240px] sm:h-[255px] flex-shrink-0 bg-[#0f0f0f] border border-[#252525] overflow-hidden flex items-center justify-center">
                    <img
                      src={person.photo}
                      alt={person.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover object-top"
                      onError={e => {
                        const el = e.target as HTMLImageElement;
                        const wrap = el.parentElement;
                        if (wrap) {
                          el.style.display = 'none';
                          wrap.style.color = '#706858';
                          wrap.style.fontSize = '10px';
                          wrap.style.letterSpacing = '3px';
                          wrap.style.textTransform = 'uppercase';
                          wrap.style.textAlign = 'center';
                          wrap.style.lineHeight = '2';
                          wrap.innerHTML = person.name.split(' ').join('<br />');
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <div
                      className="serif text-[#efe7d4] mb-1.5"
                      style={{ fontSize: 'clamp(26px, 2.4vw, 32px)', fontWeight: 600, letterSpacing: '0.01em' }}
                    >
                      {person.name}
                    </div>
                    <div className="text-[9.5px] font-medium tracking-[4px] text-[#c9a84c] uppercase mb-5">
                      {person.role}
                    </div>
                    <div className="w-7 h-px bg-[#c9a84c] mb-[18px]" />
                    <p className="text-[12px] font-light text-[#706858] leading-[1.95]">
                      {person.bio}
                    </p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>

        <div className="stack-dim" />
      </section>

      {/* ── BOOK A MEETING ──────────────────────────────────────────────── */}
      <section
        id="contact"
        data-stack
        className="stack-panel py-[120px] px-7 md:px-[70px] bg-[#0d130e] flex items-center relative overflow-hidden"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 65% 55% at 50% 0%, rgba(34,60,40,0.55) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 100%, rgba(201,168,76,0.06) 0%, transparent 60%)',
          }}
        />
        <div className="max-w-[1060px] mx-auto w-full relative z-10">
          <FadeIn className="text-center mb-[60px]">
            <p className="text-[9.5px] font-semibold tracking-[5.5px] text-[#c9a84c] uppercase mb-[18px]">
              Take the First Step
            </p>
            <h2
              className="serif text-[#efe7d4] mb-[18px]"
              style={{ fontSize: 'clamp(36px, 5.2vw, 64px)', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1.04 }}
            >
              Let's Grow Your{' '}
              <em className="text-[#c9a84c]" style={{ fontWeight: 600 }}>Wealth Together</em>
            </h2>
            <div className="w-[64px] h-px bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent mx-auto mb-[18px]" />
            <p className="text-[13px] font-light text-[#706858] tracking-[1px] leading-[1.9] max-w-[500px] mx-auto">
              Schedule a private consultation with our team to explore how Griep
              Mendes can help you achieve your financial goals — with no
              obligation to commit.
            </p>
          </FadeIn>

          <div className="grid lg:grid-cols-2 gap-20 items-start">
            {/* Why book */}
            <FadeIn>
              <h3 className="serif text-[#efe7d4] mb-[22px]" style={{ fontSize: 'clamp(24px, 2.4vw, 32px)', fontWeight: 500, letterSpacing: '0.01em' }}>
                Why Book a Consultation?
              </h3>
              <p className="text-[13px] font-light text-[#706858] leading-[1.95] mb-[30px]">
                Our introductory meeting is designed to understand your financial
                goals, risk tolerance, and investment timeline. Everything
                discussed is strictly private and carries zero obligation.
              </p>
              {[
                {
                  title: 'Private & Confidential',
                  body: 'All conversations are protected. We take your privacy seriously.',
                },
                {
                  title: 'No Obligation',
                  body: 'An initial consultation carries no commitment. Simply explore the possibilities.',
                },
                {
                  title: 'Personalized Strategy',
                  body: 'We build every investment approach around your specific goals and timeline.',
                },
                {
                  title: 'A Track Record You Can Trust',
                  body: '25% average annual return over 8 consecutive years, backed by disciplined strategy and verifiable results.',
                },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-3.5 mb-5">
                  <span className="text-[#c9a84c] text-[12px] mt-[3px] flex-shrink-0">
                    ◆
                  </span>
                  <span className="text-[12px] font-light text-[#706858] leading-[1.75]">
                    <strong className="text-[#d8cdb8] font-semibold">{f.title}</strong>
                    <br />
                    {f.body}
                  </span>
                </div>
              ))}
            </FadeIn>

            {/* Form */}
            <FadeIn delay={150}>
              {formSent ? (
                <div className="border border-green-500 bg-green-500/10 p-5 text-center text-[13px] text-green-400 tracking-[1px]">
                  ✓ &nbsp;Your request has been received. We will be in touch
                  shortly.
                </div>
              ) : (
                <form
                  className="flex flex-col gap-[18px]"
                  onSubmit={e => {
                    e.preventDefault();
                    setFormSending(true);
                    setTimeout(() => setFormSent(true), 900);
                  }}
                >
                  {[
                    {
                      label: 'Full Name',
                      type: 'text',
                      placeholder: 'Your full name',
                      required: true,
                    },
                    {
                      label: 'Email Address',
                      type: 'email',
                      placeholder: 'your@email.com',
                      required: true,
                    },
                    {
                      label: 'Phone Number',
                      type: 'tel',
                      placeholder: '+1 (000) 000-0000',
                      required: false,
                    },
                  ].map(f => (
                    <div key={f.label} className="flex flex-col gap-1.5">
                      <label className="text-[9.5px] font-semibold tracking-[2.5px] text-[#706858] uppercase">
                        {f.label}
                      </label>
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        required={f.required}
                        className="lux-field bg-[#0f0f0f] border border-[#252525] text-[#efe7d4] px-4 py-3.5 text-[13px] font-light outline-none focus:border-[#c9a84c] placeholder:text-[#706858]/50"
                      />
                    </div>
                  ))}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9.5px] font-semibold tracking-[2.5px] text-[#706858] uppercase">
                      Investment Range
                    </label>
                    <select className="lux-field bg-[#0f0f0f] border border-[#252525] text-[#d8cdb8] px-4 py-3.5 text-[13px] font-light outline-none focus:border-[#c9a84c]">
                      <option value="">Select investment range</option>
                      {[
                        '$10,000 – $50,000',
                        '$50,000 – $100,000',
                        '$100,000 – $500,000',
                        '$500,000 – $1,000,000',
                        '$1,000,000+',
                      ].map(r => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9.5px] font-semibold tracking-[2.5px] text-[#706858] uppercase">
                      Message (Optional)
                    </label>
                    <textarea
                      placeholder="Tell us about your investment goals…"
                      className="lux-field bg-[#0f0f0f] border border-[#252525] text-[#efe7d4] px-4 py-3.5 text-[13px] font-light outline-none focus:border-[#c9a84c] placeholder:text-[#706858]/50 resize-y min-h-[96px]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={formSending}
                    className="btn-lux bg-[#c9a84c] text-[#080808] py-4 w-full text-[10px] font-semibold tracking-[3px] uppercase hover:bg-[#d8bd72] disabled:opacity-70 disabled:cursor-wait disabled:hover:bg-[#c9a84c]"
                  >
                    {formSending ? 'Sending…' : 'Request a Meeting'}
                  </button>
                  <p className="text-[9.5px] text-[#706858] leading-[1.65] tracking-[0.4px]">
                    By submitting this form, you agree that your information will
                    be used solely to contact you regarding Griep Mendes
                    Investments. We do not share personal data with third
                    parties.
                  </p>
                </form>
              )}
            </FadeIn>
          </div>
        </div>

        <div className="stack-dim" />
      </section>

      </div>
      {/* ═══════════ /STACKING SECTIONS ═══════════ */}

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="bg-[#080808] border-t border-[#252525] py-[60px] px-7 md:px-[70px]">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-[18px] mb-9 pb-9 border-b border-[#252525]">
            <div className="flex items-center gap-3.5">
              <img src="/assets/bull.png" alt="" className="h-[34px] w-auto" />
              <div>
                <div className="text-[15px] font-black tracking-[4px] text-white uppercase">
                  Griep Mendes
                </div>
                <div className="text-[8px] font-light tracking-[7px] text-[#c9a84c] uppercase">
                  Investments
                </div>
              </div>
            </div>
            <div className="text-center text-[9.5px] font-light tracking-[5px] text-[#706858] uppercase">
              Capital Meets Conviction
            </div>
            <div className="flex gap-3.5 md:justify-end">
              {['f', '𝕏', 'in', 'ig'].map(s => (
                <a
                  key={s}
                  href="#"
                  className="w-[34px] h-[34px] border border-[#252525] flex items-center justify-center text-[#706858] text-[11px] font-bold hover:border-[#c9a84c] hover:text-[#c9a84c] transition-all duration-300"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-3.5">
            <p className="text-[9.5px] font-light text-[#706858] tracking-[1px]">
              © 2025 Griep Mendes Investments. All rights reserved.
            </p>
            <nav className="flex gap-7">
              {['Privacy Policy', 'Terms of Use', 'Disclosures'].map(l => (
                <a
                  key={l}
                  href="#"
                  className="text-[9.5px] tracking-[2px] text-[#706858] uppercase hover:text-[#c9a84c] transition-colors duration-300"
                >
                  {l}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
