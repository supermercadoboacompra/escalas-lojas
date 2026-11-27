/* Clima da época: enfeite animado na barra azul do topo, que muda sozinho com a data
   (Natal, Ano-novo, Carnaval, Páscoa, Dia das Mães, Festa junina, Dia das Crianças; no resto do ano, céu de estrelas).
   Tudo em branco e dourado por cima do azul. Um canvas só, pausa com a aba escondida e some para quem pede menos movimento. */
(function () {
  const calmo = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sorte = (a, b) => a + Math.random() * (b - a);
  const um = (l) => l[(Math.random() * l.length) | 0];

  /* ---------- qual é a época ---------- */
  function pascoa(ano) { // algoritmo de Meeus (calendário gregoriano)
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    return new Date(ano, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
  }
  const DIA = 86400000;
  function epoca(hoje) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()), ano = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
    if ((m === 12 && dd >= 26) || (m === 1 && dd <= 6)) return "anonovo";
    if (m === 12) return "natal";
    const p = pascoa(ano), carn = new Date(p - 47 * DIA);
    if (d >= new Date(carn - 4 * DIA) && d <= new Date(+carn + DIA)) return "carnaval";
    if (d >= new Date(p - 10 * DIA) && d <= p) return "pascoa";
    if (m === 5) { const seg = 1 + ((7 - new Date(ano, 4, 1).getDay()) % 7) + 7; if (dd >= seg - 7 && dd <= seg) return "maes"; }
    if (m === 6) return "junina";
    if (m === 10 && dd >= 5 && dd <= 12) return "criancas";
    return "brilhos";
  }
  /* pelo mês da escala aberta: dezembro = Natal, janeiro = ano-novo, mês do Carnaval, mês da Páscoa, maio = Mães, junho = junina, outubro = crianças */
  function epocaDoMes(ano, mes) {
    if (mes === 12) return "natal";
    if (mes === 1) return "anonovo";
    const p = pascoa(ano), carn = new Date(p - 47 * DIA);
    if (mes === carn.getMonth() + 1) return "carnaval";
    if (mes === p.getMonth() + 1) return "pascoa";
    if (mes === 5) return "maes";
    if (mes === 6) return "junina";
    if (mes === 10) return "criancas";
    return "brilhos";
  }
  function mesDaEscala() { try { if (typeof ESC !== "undefined" && ESC && /^\d{4}-\d{2}$/.test(String(ESC.mes))) { const [a, m] = String(ESC.mes).split("-").map(Number); return { a, m }; } } catch (e) {} return null; }
  const epocaAtual = () => { if (window.TEMA_FORCADO) return window.TEMA_FORCADO; const em = mesDaEscala(); return em ? epocaDoMes(em.a, em.m) : epoca(new Date()); };

  /* ---------- formas (tudo branco, com toque de dourado) ---------- */
  const QTD = 0.4, TAM = 0.65, OPAC = 0.32; // bem discreto: poucos, pequenos e quase transparentes
  const BRANCO = [255, 255, 255], OURO = [255, 214, 120], GELO = [200, 225, 255];
  const rgba = (c, a) => `rgba(255,255,255,${a})`; // tudo branco (pedido do usuário: sem cor nos efeitos)
  function halo(g, x, y, r, cor, a) { const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, rgba(cor, a)); grd.addColorStop(1, rgba(cor, 0)); g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
  function estrela4(g, s, cor, a) {
    g.fillStyle = rgba(cor, a);
    g.beginPath(); g.moveTo(0, -s * 2); g.quadraticCurveTo(s * 0.22, -s * 0.22, s * 2, 0); g.quadraticCurveTo(s * 0.22, s * 0.22, 0, s * 2); g.quadraticCurveTo(-s * 0.22, s * 0.22, -s * 2, 0); g.quadraticCurveTo(-s * 0.22, -s * 0.22, 0, -s * 2); g.fill();
  }
  const ponto = (g, p, a) => { halo(g, p.x, p.y, p.r * 4, p.cor, a * 0.35); g.fillStyle = rgba(p.cor, a); g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill(); };
  const brilho = (g, p, a) => { g.save(); g.translate(p.x, p.y); g.rotate(p.fase * 0.25); halo(g, 0, 0, p.r * 5, p.cor, a * 0.4); estrela4(g, p.r * (0.75 + 0.25 * p.pisca), p.cor, a); g.restore(); };
  // céu: pontinhos que piscam + estrelas de 4 pontas, mais perto do nome do site
  function ceu(c, espalhar, estrelaChance) {
    const perto = c.alvo && Math.random() < 0.45, est = Math.random() < estrelaChance;
    return { x: perto ? c.alvo.x - 16 + Math.random() * (c.alvo.w + 32) : Math.random() * c.w, y: Math.random() * c.h, vx: sorte(-0.06, 0.06), vy: sorte(-0.05, 0.02),
      r: est ? sorte(1.6, 3.2) : sorte(0.5, 1.4), cor: Math.random() < 0.75 ? BRANCO : Math.random() < 0.6 ? OURO : GELO, tipo: est ? "estrela" : "ponto", dura: sorte(160, 420) };
  }
  const desenhaCeu = (g, p, a) => (p.tipo === "estrela" ? brilho(g, p, a) : ponto(g, p, a));
  // caindo (neve, confete): nasce em cima e desce
  const caindo = (c, espalhar, extra) => Object.assign({ x: Math.random() * c.w, y: espalhar ? Math.random() * c.h : -6, vx: sorte(-0.2, 0.2), vy: sorte(0.15, 0.45), dura: 9999 }, extra);
  // subindo (corações, ovos, balões): nasce embaixo e sobe devagar
  const subindo = (c, espalhar, extra) => Object.assign({ x: Math.random() * c.w, y: espalhar ? Math.random() * c.h : c.h + 10, vx: sorte(-0.1, 0.1), vy: -sorte(0.12, 0.3), dura: 9999 }, extra);

  const TEMAS = {
    brilhos: { quantos: (w) => Math.min(80, 26 + w / 22), nova: (c, e) => ceu(c, e, 0.16), desenhar: desenhaCeu, cadente: true },
    natal: {
      quantos: (w) => Math.min(90, 30 + w / 20),
      // flocos, arvorezinhas e manjedouras voando devagar pela barra (da esquerda para a direita), com neve fininha caindo
      // quase tudo pontinhos de neve; das figuras, no máximo uma de cada voando por vez
      nova(c, e) {
        const voando = (t) => c.ps.some((q) => q.tipo === t);
        const faltam = ["floco", "arvore", "manjedoura"].filter((t) => !voando(t));
        if (!faltam.length || Math.random() < 0.88) return caindo(c, e, { r: sorte(0.6, 1.4), cor: BRANCO, tipo: "neve" });
        const tipo = um(faltam);
        return { x: e ? Math.random() * c.w : -8, y: sorte(8, c.h - 8), vx: sorte(0.12, 0.32), vy: 0, r: tipo === "floco" ? sorte(2.6, 4) : sorte(5, 7), cor: BRANCO, tipo, dura: 9999, voa: true };
      },
      desenhar(g, p, a) {
        if (p.tipo === "neve") return ponto(g, p, a * 0.95);
        const y = p.y + Math.sin(p.fase) * 2.5;   // balança de leve enquanto voa
        g.save(); g.translate(p.x, y); g.rotate(Math.sin(p.fase * 0.7) * 0.15);
        g.strokeStyle = rgba(BRANCO, a); g.fillStyle = rgba(BRANCO, a); g.lineWidth = 1; g.lineCap = "round"; g.lineJoin = "round";
        const s = p.r;
        if (p.tipo === "floco") {
          g.rotate(p.fase * 0.2);
          const t = s * 2.2; for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -t); g.moveTo(0, -t * 0.55); g.lineTo(t * 0.3, -t * 0.82); g.moveTo(0, -t * 0.55); g.lineTo(-t * 0.3, -t * 0.82); g.stroke(); }
        } else if (p.tipo === "arvore") {
          // três andares de pinheiro + tronco + estrelinha na ponta
          [[-1.1, 0.55], [-0.35, 0.8], [0.4, 1.05]].forEach(([topo, larg]) => { g.beginPath(); g.moveTo(0, (topo - 0.55) * s); g.lineTo(larg * s, (topo + 0.45) * s); g.lineTo(-larg * s, (topo + 0.45) * s); g.closePath(); g.fill(); });
          g.fillRect(-s * 0.16, s * 0.85, s * 0.32, s * 0.4);
          g.save(); g.translate(0, -s * 1.85); estrela4(g, s * 0.22, BRANCO, a); g.restore();
        } else {
          // manjedoura: cocho com palha, pernas em X e a estrela em cima
          g.beginPath(); g.moveTo(-s * 1.1, -s * 0.2); g.lineTo(s * 1.1, -s * 0.2); g.lineTo(s * 0.75, s * 0.45); g.lineTo(-s * 0.75, s * 0.45); g.closePath(); g.fill();
          g.beginPath(); for (let k = -2; k <= 2; k++) { g.moveTo(k * s * 0.32, -s * 0.2); g.lineTo(k * s * 0.42, -s * 0.48); } g.stroke();
          g.beginPath(); g.moveTo(-s * 0.7, s * 0.45); g.lineTo(-s * 0.15, s * 1.15); g.moveTo(-s * 0.15, s * 0.45); g.lineTo(-s * 0.7, s * 1.15); g.moveTo(s * 0.7, s * 0.45); g.lineTo(s * 0.15, s * 1.15); g.moveTo(s * 0.15, s * 0.45); g.lineTo(s * 0.7, s * 1.15); g.stroke();
          g.save(); g.translate(0, -s * 1.3); halo(g, 0, 0, s * 0.9, BRANCO, a * 0.4); estrela4(g, s * 0.28, BRANCO, a); g.restore();
        }
        g.restore(); },
      some: (p, c) => (p.voa ? p.x > c.w + 12 : p.y > c.h + 8),
      cadente: true,
    },
    anonovo: { quantos: (w) => Math.min(70, 24 + w / 26), nova: (c, e) => ceu(c, e, 0.25), desenhar: desenhaCeu, fogos: true, cadente: true },
    carnaval: {
      quantos: (w) => Math.min(80, 30 + w / 22),
      nova: (c, e) => caindo(c, e, { r: sorte(1.8, 3.2), giro: sorte(0.05, 0.14), cor: Math.random() < 0.7 ? BRANCO : OURO, tipo: Math.random() < 0.3 ? "fita" : "papel" }),
      desenhar(g, p, a) { g.save(); g.translate(p.x, p.y); g.rotate(p.fase); g.scale(1, Math.cos(p.fase * 1.7)); g.fillStyle = rgba(p.cor, a); g.strokeStyle = rgba(p.cor, a);
        if (p.tipo === "fita") { g.lineWidth = 1.4; g.beginPath(); g.moveTo(-p.r * 1.8, 0); g.bezierCurveTo(-p.r * 0.6, -p.r, p.r * 0.6, p.r, p.r * 1.8, 0); g.stroke(); } else g.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        g.restore(); },
      some: (p, c) => p.y > c.h + 8,
    },
    pascoa: {
      quantos: (w) => Math.min(46, 16 + w / 45),
      nova(c, e) { if (Math.random() < 0.5) return ceu(c, e, 0.4); return subindo(c, e, { r: sorte(5, 7.5), cor: BRANCO, tipo: "ovo" }); },
      desenhar(g, p, a) {
        if (p.tipo !== "ovo") return desenhaCeu(g, p, a);
        g.save(); g.translate(p.x, p.y); g.rotate(Math.sin(p.fase) * 0.3); const r = p.r;
        halo(g, 0, 0, r * 2.4, BRANCO, a * 0.18);
        g.beginPath(); g.ellipse(0, 0, r * 0.78, r, 0, 0, 6.283); g.fillStyle = rgba(BRANCO, a * 0.9); g.fill();
        g.save(); g.clip(); g.strokeStyle = rgba(OURO, a); g.lineWidth = 1.3; g.beginPath(); for (let x = -r; x <= r; x += r / 3) g.lineTo(x, ((Math.round((x + r) / (r / 3))) % 2 ? -1 : 1) * r * 0.14); g.stroke(); g.restore();
        g.restore(); },
      some: (p) => p.dura > 5000 && p.y < -12,
    },
    maes: {
      quantos: (w) => Math.min(46, 16 + w / 45),
      nova(c, e) { if (Math.random() < 0.45) return ceu(c, e, 0.3); return subindo(c, e, { r: sorte(3, 5.5), cor: Math.random() < 0.75 ? BRANCO : [255, 190, 210], tipo: "coracao" }); },
      desenhar(g, p, a) {
        if (p.tipo !== "coracao") return desenhaCeu(g, p, a);
        g.save(); g.translate(p.x, p.y); g.rotate(Math.sin(p.fase) * 0.25); const s = p.r * (0.9 + 0.1 * p.pisca);
        halo(g, 0, 0, s * 2.6, p.cor, a * 0.2);
        g.fillStyle = rgba(p.cor, a); g.beginPath(); g.moveTo(0, s * 0.35); g.bezierCurveTo(-s * 1.2, -s * 0.5, -s * 0.5, -s * 1.3, 0, -s * 0.55); g.bezierCurveTo(s * 0.5, -s * 1.3, s * 1.2, -s * 0.5, 0, s * 0.35); g.fill(); g.restore(); },
      some: (p) => p.dura > 5000 && p.y < -12,
    },
    junina: {
      quantos: (w) => Math.min(60, 22 + w / 30),
      nova: (c, e) => subindo(c, e, { x: Math.random() * c.w, vy: -sorte(0.2, 0.5), r: sorte(0.7, 1.6), cor: um([BRANCO, OURO, [255, 190, 120]]), tipo: "faisca", dura: sorte(90, 200), vida0: true }),
      desenhar: (g, p, a) => ponto(g, p, a),
      enfeite: () => { const cores = ["rgba(255,255,255,.95)", "rgba(255,255,255,.7)"]; return `<div class="bandeirinhas"><svg viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 Q500 16 1000 2" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/>${Array.from({ length: 40 }, (_, k) => { const x = 12 + k * 24.7, t = x / 1000, y = 2 + 4 * 14 * t * (1 - t); return `<g class="band" style="--k:${k};transform-origin:${x}px ${y}px"><path d="M${x - 7} ${y} L${x + 7} ${y} L${x + 7} ${y + 13} L${x} ${y + 9} L${x - 7} ${y + 13} Z" fill="${cores[k % cores.length]}"/></g>`; }).join("")}</svg></div>`; },
    },
    criancas: {
      quantos: (w) => Math.min(30, 10 + w / 70),
      nova(c, e) { if (Math.random() < 0.5) return ceu(c, e, 0.3); return subindo(c, e, { r: sorte(5, 7), cor: BRANCO, tipo: "balao" }); },
      desenhar(g, p, a) {
        if (p.tipo !== "balao") return desenhaCeu(g, p, a);
        g.save(); g.translate(p.x + Math.sin(p.fase) * 2, p.y); const r = p.r;
        g.strokeStyle = rgba(BRANCO, a * 0.6); g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, r * 1.1); g.quadraticCurveTo(Math.sin(p.fase * 2) * 3, r * 1.8, 0, r * 2.6); g.stroke();
        halo(g, 0, 0, r * 2.2, BRANCO, a * 0.18);
        g.fillStyle = rgba(BRANCO, a * 0.92); g.beginPath(); g.ellipse(0, 0, r * 0.85, r, 0, 0, 6.283); g.fill();
        g.beginPath(); g.moveTo(-r * 0.15, r * 0.97); g.lineTo(r * 0.15, r * 0.97); g.lineTo(0, r * 1.15); g.fill();
        g.fillStyle = rgba(OURO, a * 0.7); g.beginPath(); g.ellipse(-r * 0.3, -r * 0.38, r * 0.14, r * 0.26, -0.5, 0, 6.283); g.fill(); g.restore(); },
      some: (p) => p.dura > 5000 && p.y < -24,
    },
  };

  /* ---------- o céu da barra do topo ---------- */
  const C = { cv: null, g: null, ps: [], fogos: [], cadentes: [], rodando: false, w: 0, h: 0, alvo: null, tema: null, nome: null, proxFogo: 0, proxCadente: 0 };
  function preparar() {
    const topo = document.getElementById("topo");
    if (!topo || calmo()) { C.rodando = false; return; }
    const nome = epocaAtual();
    if (nome !== C.nome) { C.nome = nome; C.tema = TEMAS[nome] || TEMAS.brilhos; C.ps = []; C.fogos = []; C.cadentes = []; }
    if (!C.cv) { C.cv = document.createElement("canvas"); C.cv.className = "ceu-topo"; C.cv.setAttribute("aria-hidden", "true"); C.g = C.cv.getContext("2d"); }
    if (C.cv.parentNode !== topo) topo.prepend(C.cv);      // o topo é redesenhado às vezes: recoloca o mesmo céu
    topo.dataset.epoca = nome;
    let enf = topo.querySelector(".enfeite-epoca");
    if (!enf || enf.dataset.epoca !== nome) {
      if (enf) enf.remove();
      const html = C.tema.enfeite ? C.tema.enfeite() : "";
      if (html) { enf = document.createElement("div"); enf.className = "enfeite-epoca"; enf.dataset.epoca = nome; enf.setAttribute("aria-hidden", "true"); enf.innerHTML = html; topo.appendChild(enf); }
    }
    medir();
    if (!C.rodando) { C.rodando = true; requestAnimationFrame(quadro); }
  }
  function medir() {
    const topo = C.cv && C.cv.parentNode; if (!topo) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), r = topo.getBoundingClientRect();
    if (Math.abs(r.width - C.w) > 1 || Math.abs(r.height - C.h) > 1 || !C.cv.width) {
      C.w = r.width; C.h = r.height;
      C.cv.width = Math.round(r.width * dpr); C.cv.height = Math.round(r.height * dpr);
      C.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const t = topo.querySelector(".marca");
    if (t) { const rt = t.getBoundingClientRect(); C.alvo = { x: rt.left - r.left, y: rt.top - r.top, w: rt.width, h: rt.height }; }
    const quer = Math.max(6, Math.round(C.tema.quantos(r.width) * QTD));
    while (C.ps.length < quer) C.ps.push(nascer(true));
    C.ps.length = quer;
  }
  function nascer(espalhar) { const p = C.tema.nova(C, espalhar); p.fase = Math.random() * 6.28; p.giro = p.giro || sorte(0.02, 0.05); p.vida = espalhar && !p.vida0 ? Math.random() * 60 : 0; p.pisca = 1; p.r *= TAM; return p; }
  function quadro(t) {
    if (!C.rodando || !C.cv || !C.cv.isConnected) { C.rodando = false; return; }
    if (document.hidden) { requestAnimationFrame(quadro); return; }
    const g = C.g, tema = C.tema;
    g.clearRect(0, 0, C.w, C.h);
    g.globalCompositeOperation = "lighter";
    C.ps.forEach((p, k) => {
      p.vida++; p.fase += p.giro; p.y += p.vy; p.x += p.vx + Math.sin(p.fase) * 0.12;
      p.pisca = 0.5 + 0.5 * Math.sin(p.fase * 2.4);
      const acabou = (tema.some && tema.some(p, C)) || (p.dura < 5000 && p.vida >= p.dura) || p.x < -10 || p.x > C.w + 10;
      if (acabou) { C.ps[k] = nascer(false); return; }
      const sobe = Math.min(1, p.vida / 30), some = p.dura > 5000 ? 1 : Math.min(1, (p.dura - p.vida) / 50);
      const pisca = p.tipo === "estrela" || p.tipo === "ponto" ? 0.35 + 0.65 * p.pisca : 1;
      tema.desenhar(g, p, Math.max(0, sobe * some * pisca) * OPAC);
    });
    // estrela cadente atravessando a barra de vez em quando
    if (tema.cadente) {
      if (t > C.proxCadente) { if (C.proxCadente) C.cadentes.push({ x: sorte(C.w * 0.1, C.w * 0.7), y: -4, vx: sorte(5, 8), vy: sorte(1.2, 2), vida: 0, dura: sorte(40, 60) }); C.proxCadente = t + sorte(8000, 15000); }
      C.cadentes = C.cadentes.filter((s) => s.vida < s.dura && s.y < C.h + 10);
      C.cadentes.forEach((s) => { s.vida++; s.x += s.vx; s.y += s.vy; const a = Math.sin((s.vida / s.dura) * Math.PI);
        const grd = g.createLinearGradient(s.x, s.y, s.x - s.vx * 12, s.y - s.vy * 12); grd.addColorStop(0, rgba(BRANCO, a)); grd.addColorStop(1, rgba(BRANCO, 0));
        g.strokeStyle = grd; g.lineWidth = 1; g.lineCap = "round"; g.globalAlpha = OPAC * 1.3; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx * 9, s.y - s.vy * 9); g.stroke(); g.globalAlpha = 1; halo(g, s.x, s.y, 3.5, BRANCO, a * OPAC); });
    }
    // fogos do ano-novo, perto do nome do site
    if (tema.fogos) {
      if (t > C.proxFogo) { const a = C.alvo || { x: 20, y: 10, w: 200, h: 30 }; const x = a.x + Math.random() * (a.w + 120), y = sorte(10, C.h - 10), cor = um([BRANCO, OURO, GELO]);
        for (let k = 0; k < 16; k++) { const ang = (k / 16) * 6.283, v = sorte(0.6, 1.2); C.fogos.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vida: 0, dura: sorte(40, 65), cor }); }
        C.proxFogo = t + sorte(2600, 4800); }
      C.fogos = C.fogos.filter((f) => f.vida < f.dura);
      C.fogos.forEach((f) => { f.vida++; f.vy += 0.02; f.vx *= 0.96; f.vy *= 0.96; f.x += f.vx; f.y += f.vy; const a = (1 - f.vida / f.dura) * OPAC; halo(g, f.x, f.y, 2.5, f.cor, a * 0.5); g.fillStyle = rgba(f.cor, a); g.beginPath(); g.arc(f.x, f.y, 0.8, 0, 6.283); g.fill(); });
    }
    requestAnimationFrame(quadro);
  }
  window.addEventListener("resize", () => { if (C.cv && C.cv.isConnected) medir(); });
  // o topo é montado de novo em várias horas (trocar escala, salvar): sempre recoloca o céu
  const topo = document.getElementById("topo");
  if (topo && window.MutationObserver) new MutationObserver(() => { if (C.cv && C.cv.parentNode !== topo) { C.nome = C.nome; preparar(); } }).observe(topo, { childList: true });

  /* reflexo dourado que passa no nome do site quando a página abre */
  function reluzir() { const m = document.querySelector("#topo .marca span:not(.ponto)"); if (m && !calmo()) { m.classList.remove("reluz"); void m.offsetWidth; m.classList.add("reluz"); } }
  const render0 = window.render;
  window.render = function () { render0(); preparar(); };
  window.trocarEpoca = (nome) => { window.TEMA_FORCADO = nome || null; C.nome = null; const e = document.querySelector("#topo .enfeite-epoca"); if (e) e.remove(); preparar(); reluzir(); };
  window.EPOCAS = Object.keys(TEMAS);
  requestAnimationFrame(() => { preparar(); reluzir(); });
})();
