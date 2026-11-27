/* Efeitos visuais do site (carrega depois do app.js).
   Só anima em resposta ao que a pessoa faz, e nada anima se o aparelho pedir menos movimento. */
(function () {
  const calmo = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- linha laranja que desliza até a aba escolhida ---------- */
  function posicionarIndicador(animar) {
    const nav = document.getElementById("abas"); if (!nav) return;
    let ind = nav.querySelector(".abas-ind");
    if (!ind) { ind = document.createElement("span"); ind.className = "abas-ind"; nav.appendChild(ind); }
    const at = nav.querySelector("a.ativa");
    if (!at) { ind.style.opacity = "0"; return; }
    if (!animar) ind.style.transition = "none";
    ind.style.opacity = "1";
    ind.style.width = at.offsetWidth - 20 + "px";
    ind.style.transform = `translateX(${at.offsetLeft + 10}px)`;
    if (!animar) requestAnimationFrame(() => (ind.style.transition = ""));
  }
  let ultimaPos = null;
  const montarAbas0 = window.montarAbas;
  window.montarAbas = function (rota) {
    const nav = document.getElementById("abas");
    const ind = nav && nav.querySelector(".abas-ind");
    const antes = ind ? ind.style.transform : null;
    montarAbas0(rota);
    // o innerHTML apagou o indicador: recoloca onde estava e anima até a aba nova
    if (nav && antes) { const novo = document.createElement("span"); novo.className = "abas-ind"; novo.style.transition = "none"; novo.style.transform = antes; novo.style.width = ind.style.width; nav.appendChild(novo); requestAnimationFrame(() => { novo.style.transition = ""; posicionarIndicador(true); }); }
    else requestAnimationFrame(() => posicionarIndicador(false));
    const at = nav && nav.querySelector("a.ativa");
    if (at && at.scrollIntoView && ultimaPos !== rota) at.scrollIntoView({ block: "nearest", inline: "nearest", behavior: calmo() ? "auto" : "smooth" });
    ultimaPos = rota;
  };
  window.addEventListener("resize", () => posicionarIndicador(false));

  /* ---------- números contam até o valor quando a tela abre ---------- */
  function contar(c) {
    if (calmo()) return;
    c.querySelectorAll("[data-conta]").forEach((el) => {
      const alvo = +el.dataset.conta; if (!alvo) return;
      const t0 = performance.now(), dur = Math.min(900, 300 + alvo * 30);
      const passo = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(alvo * e); if (k < 1) requestAnimationFrame(passo); };
      el.textContent = "0"; requestAnimationFrame(passo);
    });
  }

  /* ---------- troca de tela: o conteúdo entra suave; o mês cresce só na primeira vez ---------- */
  let rotaAntes = null;
  const render0 = window.render;
  window.render = function () {
    render0();
    const c = document.getElementById("conteudo"); if (!c) return;
    const rota = (location.hash.replace(/^#\//, "") || "inicio").split("?")[0];
    const trocou = rota !== rotaAntes; rotaAntes = rota;
    c.classList.toggle("parado", !trocou);
    if (trocou && !calmo()) { c.classList.remove("entra"); void c.offsetWidth; c.classList.add("entra"); contar(c); }
  };

  /* ---------- avisos: entram deslizando e saem encolhendo ---------- */
  const toast0 = window.toast;
  window.toast = function (msg, acao) {
    toast0(msg, acao);
    const t = document.querySelector("#toasts .toast:last-child"); if (!t) return;
    const sair = () => { if (!t.isConnected) return; t.classList.add("sai"); setTimeout(() => t.remove(), 220); };
    setTimeout(sair, acao ? 6800 : 3800);
  };

  /* ---------- confete nas cores da marca ao lançar a escala ---------- */
  window.festa = function () {
    if (calmo()) return;
    const cv = document.createElement("canvas"); cv.className = "festa";
    const dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; document.body.appendChild(cv);
    const g = cv.getContext("2d"); g.scale(dpr, dpr);
    const cores = ["#f26522", "#fbb616", "#003462", "#2f6fb3", "#ffffff"];
    const ps = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 120, y: H * 0.55, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 15 - 6,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, c: cores[(Math.random() * cores.length) | 0],
    }));
    const t0 = performance.now();
    const quadro = (t) => {
      const k = (t - t0) / 1800; g.clearRect(0, 0, W, H);
      ps.forEach((p) => { p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.globalAlpha = Math.max(0, 1 - k * k); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); });
      if (k < 1) requestAnimationFrame(quadro); else cv.remove();
    };
    requestAnimationFrame(quadro);
  };

  /* a primeira tela pode ter sido desenhada antes deste arquivo carregar */
  rotaAntes = (location.hash.replace(/^#\//, "") || "inicio").split("?")[0];
  const pronto = () => posicionarIndicador(false);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(pronto);
  requestAnimationFrame(pronto);
  // o menu de abas pode aparecer depois (login): observa e posiciona
  const nav = document.getElementById("abas");
  if (nav && window.MutationObserver) new MutationObserver(() => { if (!nav.querySelector(".abas-ind") && nav.querySelector("a.ativa")) posicionarIndicador(false); }).observe(nav, { childList: true });
})();
