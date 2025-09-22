// =========================
// ТЕМА И ХРАНЕНИЕ В localStorage
// =========================
(() => {
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const KEY = 'theme';
  const stored = localStorage.getItem(KEY);

  // Применяем сохранённую тему или следуем системной
  if (stored) {
    const isDark = stored === 'dark';
    root.classList.toggle('dark', isDark);
    toggle?.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  } else {
    const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
    toggle?.setAttribute('aria-pressed', prefersDark ? 'true' : 'false');
  }

  toggle?.addEventListener('click', () => {
    const isDark = root.classList.toggle('dark');
    localStorage.setItem(KEY, isDark ? 'dark' : 'light');
    toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  }, { passive: true });
})();

// =========================
// МОБИЛЬНОЕ МЕНЮ
// =========================
(() => {
  const btn = document.getElementById('navToggle');
  const list = document.getElementById('siteNav');
  if (!btn || !list) return;

  const close = () => {
    list.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  };

  btn.addEventListener('click', () => {
    const open = list.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // Закрываем по клику на ссылку
  list.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a) close();
  });

  // Закрытие по ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // Клик вне меню
  document.addEventListener('click', (e) => {
    if (!list.classList.contains('is-open')) return;
    if (!e.target.closest('#siteNav') && !e.target.closest('#navToggle')) {
      close();
    }
  });
})();

// =========================
// ПЛАВНЫЙ СКРОЛЛ ПО ЯКОРЯМ (улучшенный)
// =========================
(() => {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Фокус для доступности
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
      el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true });
    });
  });
})();

// =========================
// АНИМАЦИИ ПРИ СКРОЛЛЕ: IntersectionObserver
// =========================
(() => {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  els.forEach((el) => io.observe(el));
})();

// =========================
// КНОПКИ: ripple + glow позиция + «магнит»
// =========================
(() => {
  const buttons = document.querySelectorAll('.btn');
  let raf = null;

  buttons.forEach((btn) => {
    // Ripple эффект
    btn.addEventListener('click', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      btn.style.setProperty('--rx', `${x}px`);
      btn.style.setProperty('--ry', `${y}px`);
      btn.classList.remove('ripple');
      void btn.offsetWidth; // reflow
      btn.classList.add('ripple');
      setTimeout(() => btn.classList.remove('ripple'), 700);
    });

    // Glow + магнит с rAF-троттлингом
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const tx = (x - rect.width / 2) * 0.06;
        const ty = (y - rect.height / 2) * 0.06;
        btn.style.setProperty('--mx', `${(x / rect.width) * 100}%`);
        btn.style.setProperty('--my', `${(y / rect.height) * 100}%`);
        if (btn.classList.contains('mag')) {
          btn.style.setProperty('--tx', `${tx}px`);
          btn.style.setProperty('--ty', `${ty}px`);
        }
      });
    };

    btn.addEventListener('pointermove', onMove);
    btn.addEventListener('pointerleave', () => {
      if (btn.classList.contains('mag')) {
        btn.style.setProperty('--tx', `0px`);
        btn.style.setProperty('--ty', `0px`);
      }
    });
  });
})();

// =========================
// ФОНОВЫЕ ЧАСТИЦЫ НА CANVAS + ОТКЛЮЧЕНИЕ
// =========================
(() => {
  const canvas = document.getElementById('bg-canvas');
  const toggleBtn = document.getElementById('toggle-bg');
  if (!canvas || !toggleBtn) return;

  const KEY = 'bg-anim';
  const ctx = canvas.getContext('2d', { alpha: true });
  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let rafId = null;
  let particles = [];
  let width = 0;
  let height = 0;
  let enabled = localStorage.getItem(KEY) || 'on';
  let pausedByPrefers = false;
  let hiddenPause = false;

  const mReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const setBtnLabel = () => {
    const isOn = !pausedByPrefers && enabled !== 'off' && !hiddenPause;
    toggleBtn.querySelector('.btn__label')?.replaceChildren(document.createTextNode(`Анимация: ${isOn ? 'вкл' : 'выкл'}`));
    toggleBtn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
  };

  const resize = () => {
    const cw = canvas.clientWidth || window.innerWidth;
    const ch = canvas.clientHeight || window.innerHeight;
    width = cw;
    height = ch;
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const rand = (min, max) => Math.random() * (max - min) + min;

  const createParticles = (count) => {
    particles = Array.from({ length: count }, () => ({
      x: rand(0, width),
      y: rand(0, height),
      r: rand(1, 2.5),
      a: rand(0.2, 0.7),
      vx: rand(-0.25, 0.25),
      vy: rand(-0.25, 0.25),
      hue: Math.random()
    }));
  };

  const draw = () => {
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;

      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 8);
      const c1 = `hsla(${Math.floor(220 + 100 * p.hue)}, 80%, 65%, ${p.a})`;
      const c2 = `hsla(${Math.floor(180 + 80 * p.hue)}, 80%, 60%, 0)`;
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const loop = () => {
    if (pausedByPrefers || enabled === 'off' || hiddenPause) return;
    draw();
    rafId = requestAnimationFrame(loop);
  };

  const start = () => {
    cancel();
    resize();
    const density = Math.round((width * height) / 28000);
    createParticles(Math.max(24, Math.min(120, density)));
    rafId = requestAnimationFrame(loop);
  };

  const cancel = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    ctx.clearRect(0, 0, width, height);
  };

  const applyState = () => {
    pausedByPrefers = mReduced.matches;
    setBtnLabel();
    if (pausedByPrefers || enabled === 'off' || hiddenPause) {
      cancel();
    } else {
      start();
    }
  };

  // Инициализация
  localStorage.setItem(KEY, enabled);
  applyState();

  // Toggle кнопка
  toggleBtn.addEventListener('click', () => {
    enabled = enabled === 'on' ? 'off' : 'on';
    localStorage.setItem(KEY, enabled);
    applyState();
  });

  // Resize с дебаунсом
  let resizeTO = null;
  const onResize = () => {
    if (pausedByPrefers || enabled === 'off' || hiddenPause) return;
    clearTimeout(resizeTO);
    resizeTO = setTimeout(start, 100);
  };
  window.addEventListener('resize', onResize);

  // Слушаем prefers-reduced-motion
  mReduced.addEventListener?.('change', applyState);

  // Пауза, когда вкладка скрыта
  document.addEventListener('visibilitychange', () => {
    hiddenPause = document.hidden;
    applyState();
  });

  // Очистка
  window.addEventListener('beforeunload', () => {
    window.removeEventListener('resize', onResize);
    cancel();
  });
})();

// =========================
// МАЛЕНЬКИЕ УЛУЧШЕНИЯ UX
// =========================
(() => {
  // Подсветка активной секции в меню
  const links = Array.from(document.querySelectorAll('.nav__link'));
  const sections = links
    .map((l) => document.querySelector(l.getAttribute('href')))
    .filter(Boolean);

  if (sections.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const idx = sections.indexOf(entry.target);
        if (idx >= 0 && entry.isIntersecting) {
          links.forEach((lnk) => lnk.classList.remove('is-active'));
          links[idx].classList.add('is-active');
        }
      });
    },
    { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
  );

  sections.forEach((sec) => observer.observe(sec));

  // Улучшение: если пользователь табом проходит по ссылкам меню — подсветка не мешает
  links.forEach((lnk) => {
    lnk.addEventListener('focus', () => {
      links.forEach((k) => k.classList.remove('is-active'));
      lnk.classList.add('is-active');
    });
  });
})();
