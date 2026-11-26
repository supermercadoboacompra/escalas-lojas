/* ================= Escalas das Lojas =================
   O gerente vê, mexe e lança a escala da loja dele. A escala montada fica guardada como "padrão" e nunca se perde.
   Dados no banco (login + regras do banco). Nada de nome de funcionário neste código: o repositório é público. */
"use strict";
const NUVEM = { url: "https://rodejhzalrcdhbcnwobf.supabase.co", chave: "sb_publishable_VoW5YrT-pAbSoRyCYg7ezg_VE2FG5cB" };
const DOMINIO = "usuarios.equipe.invalid";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const ORDEM_SETOR = ["Gerência", "Fiscal", "Operadora", "Pacote", "Reposição", "Açougue", "Padaria", "Hortifruti", "Frios", "Lanchonete", "Cozinha"];

let SB = null, EU = null, ACESSO = null, LISTA = [], RESUMO = null;
let ESC = null, E = null, P = null, VAL = null, MUD = null, DESFAZER = [];
let DIA_SEL = null, FILTRO = { setor: "", busca: "", so: "" };
let _salvarT = null, _salvando = false, _salvoEm = null, _erroSalvar = null;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const IC = {
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  voltar: '<path d="M15 5l-7 7 7 7"/>',
  desfazer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  imprimir: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  baixar: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  sair: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h11"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lua: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  esq: '<path d="M15 5l-7 7 7 7"/>', dir: '<path d="M9 5l7 7-7 7"/>',
};
const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
const ehAdmin = () => ACESSO && ACESSO.papel === "admin";
const travada = () => !ESC || ESC.status === "lancada";
const pessoa = (id) => E.pessoas.find((p) => p.id === id);
const padraoDe = (id) => P.pessoas.find((p) => p.id === id);
const mesTxt = (m) => { const [a, n] = String(m).split("-"); return MESES[+n - 1] + " de " + a; };
const quando = (t) => (t ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const ordemSetor = (s) => { const i = ORDEM_SETOR.indexOf(s); return i < 0 ? 99 : i; };
const setoresDe = (Ex) => [...new Set(Ex.pessoas.filter((p) => !p.fora).map((p) => p.setor))].sort((a, b) => ordemSetor(a) - ordemSetor(b) || a.localeCompare(b));
const primeiroNome = (n) => String(n || "").split(" ")[0];

/* ---------- avisos rápidos e janelas ---------- */
function toast(msg, acao) {
  const t = document.createElement("div"); t.className = "toast";
  t.innerHTML = `<span>${esc(msg)}</span>${acao ? `<button>${esc(acao.rotulo)}</button>` : ""}`;
  if (acao) t.querySelector("button").onclick = () => { acao.fn(); t.remove(); };
  $("#toasts").appendChild(t); setTimeout(() => t.remove(), acao ? 7000 : 4000);
}
function modal(html, botoes) {
  const f = document.createElement("div"); f.className = "modal-fundo";
  f.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}<div class="linha fim" style="margin-top:18px">${botoes.map((b, k) => `<button class="btn ${b.tipo || ""}" data-k="${k}">${esc(b.rotulo)}</button>`).join("")}</div></div>`;
  const fechar = () => f.remove();
  f.onclick = (e) => { if (e.target === f) fechar(); };
  $$("button[data-k]", f).forEach((bt) => (bt.onclick = async () => { const b = botoes[+bt.dataset.k]; if (b.fn && (await b.fn(f)) === false) return; fechar(); }));
  document.body.appendChild(f);
  return f;
}
function fecharPainel() { const p = $(".fundo-painel"); if (p) p.remove(); }
function abrirPainel(html) {
  fecharPainel();
  const f = document.createElement("div"); f.className = "fundo-painel";
  f.innerHTML = `<aside class="painel">${html}</aside>`;
  f.onclick = (e) => { if (e.target === f) fecharPainel(); };
  document.body.appendChild(f);
  return $(".painel", f);
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { const m = $(".modal-fundo"); if (m) m.remove(); else fecharPainel(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); desfazer(); }
});

/* ---------- tema ---------- */
function aplicarTema(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; try { t ? localStorage.setItem("tema", t) : localStorage.removeItem("tema"); } catch (e) {} montarTopo(); }
function temaAtual() { const t = document.documentElement.dataset.theme; return t || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }

/* ================= LOGIN ================= */
function telaLogin(msg) {
  $("#topo").innerHTML = `<div class="marca"><span class="ponto"></span><span>Escalas das Lojas</span></div>`;
  $("#abas").style.display = "none";
  $("#conteudo").innerHTML = `<section class="cartao centro login">
    <h1>Escalas das Lojas</h1><p class="dica" style="text-align:center">Entre com o usuário da sua loja.</p>
    ${msg ? `<p class="login-msg">${esc(msg)}</p>` : ""}
    <form id="fLogin">
      <label class="campo"><span>Usuário</span><input name="u" autocomplete="username" autocapitalize="none" spellcheck="false" required placeholder="ex.: sbc1"></label>
      <label class="campo"><span>Senha</span><input name="s" type="password" autocomplete="current-password" required></label>
      <button class="btn primario largo grande" type="submit">Entrar</button>
    </form></section>`;
  $("#fLogin").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), bt = $("#fLogin button"); bt.disabled = true; bt.textContent = "Entrando...";
    let u = String(f.get("u")).trim().toLowerCase().replace(/\s+/g, ""); if (!u.includes("@")) u += "@" + DOMINIO;
    const { error } = await SB.auth.signInWithPassword({ email: u, password: String(f.get("s")) });
    if (error) { telaLogin("Usuário ou senha não conferem."); return; }
    iniciar();
  };
}

async function iniciar() {
  try { const t = localStorage.getItem("tema"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  if (!window.supabase) { $("#conteudo").innerHTML = `<section class="cartao centro"><p>Não consegui carregar o site. Confira a internet e recarregue a página.</p></section>`; return; }
  SB = SB || window.supabase.createClient(NUVEM.url, NUVEM.chave);
  const { data: { session } } = await SB.auth.getSession();
  if (!session) { telaLogin(); return; }
  EU = session.user;
  const { data: ac } = await SB.from("escalas_acessos").select("papel,loja_cod,nome").eq("user_id", EU.id).maybeSingle();
  if (!ac) { await SB.auth.signOut(); telaLogin("Este usuário ainda não tem acesso às escalas. Fale com o escritório."); return; }
  ACESSO = ac;
  const { data, error } = await SB.from("escalas").select("id,loja_cod,loja_nome,mes,status,lancada_em,lancada_por,atualizado_em,atualizado_por").order("mes", { ascending: false });
  if (error) { telaLogin("Não consegui carregar: " + error.message); return; }
  LISTA = data.sort((a, b) => (a.mes < b.mes ? 1 : a.mes > b.mes ? -1 : 0) || ORDEM_LOJAS.indexOf(a.loja_nome) - ORDEM_LOJAS.indexOf(b.loja_nome));
  if (!LISTA.length) { $("#conteudo").innerHTML = `<section class="cartao centro"><p>Ainda não tem escala para a sua loja.</p></section>`; return; }
  $("#abas").style.display = "";
  let alvo = null; try { alvo = localStorage.getItem("escala.aberta"); } catch (e) {}
  if (!LISTA.some((l) => l.id === alvo)) alvo = ehAdmin() ? null : LISTA[0].id;
  if (alvo) await abrirEscala(alvo); else { montarTopo(); if (!location.hash || location.hash === "#/") location.hash = "#/lojas"; render(); }
  if (!iniciar._ok) { iniciar._ok = true; window.addEventListener("hashchange", render); window.addEventListener("beforeunload", (e) => { if (_salvarT || _salvando) { e.preventDefault(); e.returnValue = ""; } }); }
}
const ORDEM_LOJAS = ["SBC 1", "SBC 2", "SBC 3", "SBC 4", "SBC 5", "SL 1", "SL 2", "SL 3", "SL 4", "PA", "Locatelli 1", "Locatelli 2", "Artena", "PMN"];

async function abrirEscala(id) {
  await salvarAgora();
  $("#conteudo").innerHTML = `<section class="cartao centro"><p class="dica">Abrindo a escala...</p></section>`;
  const { data, error } = await SB.from("escalas").select("*").eq("id", id).single();
  if (error) { toast("Não consegui abrir: " + error.message); return; }
  ESC = data; P = data.padrao; E = sanear(data.atual, P); ESC.atual = E; DESFAZER = []; DIA_SEL = null; _erroSalvar = null;
  FILTRO = { setor: "", busca: "", so: "" };
  try { localStorage.setItem("escala.aberta", id); } catch (e) {}
  const i = LISTA.findIndex((l) => l.id === id); if (i >= 0) Object.assign(LISTA[i], { status: data.status, lancada_em: data.lancada_em, lancada_por: data.lancada_por });
  recalcular();
  montarTopo();
  if (!location.hash || location.hash === "#/" || location.hash === "#/lojas") location.hash = "#/inicio"; else render();
}
function recalcular() { VAL = validarTudo(E, P); MUD = mudancas(E, P); }
/* A escala do gerente (atual) pode ser gravada por quem tem login. Ao abrir, a estrutura do mês vem sempre
   do padrão (que só o escritório grava) e o resto é forçado para número ou texto, para nada virar código na tela. */
function sanear(A, B) {
  const n = (v, d = null) => (v == null || v === "" || !isFinite(+v) ? d : Math.round(+v));
  const t = (v, max = 120) => String(v ?? "").slice(0, max);
  const out = clone(B);
  out.pessoas = (Array.isArray(A && A.pessoas) ? A.pessoas : B.pessoas).map((p) => ({
    id: t(p.id, 40), nome: t(p.nome), nomeCompleto: t(p.nomeCompleto), cargo: t(p.cargo), setor: t(p.setor, 40),
    horas: [42, 36, 30, 24, 20].includes(+p.horas) ? +p.horas : 42, turno: p.turno === "M" || p.turno === "T" ? p.turno : null,
    saidaMax: /^\d{2}:\d{2}$/.test(p.saidaMax || "") ? p.saidaMax : null, entradaMin: /^\d{2}:\d{2}$/.test(p.entradaMin || "") ? p.entradaMin : null,
    entradaAtual: n(p.entradaAtual), semDomingo: !!p.semDomingo, semFeriado: !!p.semFeriado, novo: !!p.novo,
    fora: p.fora ? { motivo: t(p.fora.motivo, 60) } : undefined,
    dias: B.dias.map((x, i) => {
      const c = (p.dias || [])[i] || {};
      if (c.t === "T" && n(c.ini) != null && n(c.fim) != null) { const a = Array.isArray(c.alm) && n(c.alm[0]) != null && n(c.alm[1]) != null ? [n(c.alm[0]), n(c.alm[1])] : null; return { t: "T", ini: n(c.ini), fim: n(c.fim), alm: a }; }
      return { t: ["F", "D", "X"].includes(c.t) ? c.t : "F" };
    }),
  }));
  out.pessoas.forEach((p) => { if (!p.fora) delete p.fora; });
  return out;
}

/* ================= GRAVAÇÃO ================= */
function alterar(fn, msg) {
  if (travada()) { toast("Esta escala já foi lançada. Toque em \"Reabrir\" para mudar."); return false; }
  const antes = JSON.stringify(E);
  fn();
  if (JSON.stringify(E) === antes) return false;
  DESFAZER.push(antes); if (DESFAZER.length > 60) DESFAZER.shift();
  recalcular(); agendarSalvar(); render();
  if (msg) toast(msg, { rotulo: "Desfazer", fn: desfazer });
  return true;
}
function desfazer() {
  if (travada() || !DESFAZER.length) return;
  E = JSON.parse(DESFAZER.pop()); ESC.atual = E; recalcular(); agendarSalvar(); render(); toast("Desfeito.");
}
function agendarSalvar() { ESC.atual = E; clearTimeout(_salvarT); _salvarT = setTimeout(salvarAgora, 900); mostrarSalvo(); }
async function salvarAgora() {
  if (!_salvarT) return;
  clearTimeout(_salvarT); _salvarT = null; _salvando = true; mostrarSalvo();
  const { data, error } = await SB.from("escalas").update({ atual: E }).eq("id", ESC.id).eq("versao", ESC.versao).select("versao,atualizado_em,atualizado_por");
  _salvando = false;
  if (error) { _erroSalvar = "Não salvou: " + error.message; mostrarSalvo(); toast(_erroSalvar, { rotulo: "Tentar de novo", fn: () => { _salvarT = 1; salvarAgora(); } }); return; }
  if (!data || !data.length) {
    _erroSalvar = "Não salvou"; mostrarSalvo();
    modal(`<h2>Esta escala mudou em outro lugar</h2><p>Alguém abriu a mesma escala em outro computador ou celular e mexeu (ou lançou) enquanto você trabalhava. Para não apagar o que a outra pessoa fez, a sua última mudança não foi gravada.</p><p class="dica">Recarregue para ver a versão mais nova.</p>`, [{ rotulo: "Recarregar", tipo: "primario", fn: () => abrirEscala(ESC.id) }]);
    return;
  }
  Object.assign(ESC, data[0]); _erroSalvar = null; _salvoEm = new Date(); mostrarSalvo();
  const l = LISTA.find((x) => x.id === ESC.id); if (l) Object.assign(l, data[0]);
  RESUMO = null;
}
function mostrarSalvo() {
  const el = $("#salvo"); if (!el) return;
  el.className = "salvo" + (_erroSalvar ? " erro" : "");
  el.textContent = _erroSalvar || (_salvando ? "Salvando..." : _salvarT ? "Alterado" : _salvoEm ? "Salvo às " + _salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ESC ? "Tudo salvo" : "");
}

/* ================= TOPO E ABAS ================= */
function montarTopo() {
  const lojas = [...new Map(LISTA.map((l) => [l.loja_cod, l])).values()];
  const meses = ESC ? LISTA.filter((l) => l.loja_cod === ESC.loja_cod) : [];
  const tema = temaAtual();
  $("#topo").innerHTML = `<div class="marca"><span class="ponto"></span><span class="txt">Escalas das Lojas</span></div>
    ${ehAdmin() ? `<select class="loja-sel" id="lojaSel" aria-label="Loja"><option value="">Todas as lojas</option>${lojas.map((l) => `<option value="${esc(l.loja_cod)}" ${ESC && ESC.loja_cod === l.loja_cod ? "selected" : ""}>${esc(l.loja_nome)}</option>`).join("")}</select>` : ESC ? `<span class="loja-nome">${esc(ESC.loja_nome)}</span>` : ""}
    ${meses.length > 1 ? `<select class="loja-sel" id="mesSel" aria-label="Mês">${meses.map((m) => `<option value="${esc(m.id)}" ${m.id === ESC.id ? "selected" : ""}>${esc(mesTxt(m.mes))}</option>`).join("")}</select>` : ESC ? `<span class="loja-nome" style="opacity:.75">${esc(mesTxt(ESC.mes))}</span>` : ""}
    <span class="espaco"></span><span id="salvo" class="salvo"></span>
    <div class="tema-chave" role="group" aria-label="Aparência"><button data-tema="light" class="${tema === "light" ? "sel" : ""}" title="Claro" aria-label="Modo claro">${ic("sol")}</button><button data-tema="dark" class="${tema === "dark" ? "sel" : ""}" title="Escuro" aria-label="Modo escuro">${ic("lua")}</button></div>
    <button class="btn-topo" id="sair" title="Sair">${ic("sair")}<span class="txt-sair">${esc(primeiroNome(ACESSO.nome))}</span></button>`;
  mostrarSalvo();
  const ls = $("#lojaSel"); if (ls) ls.onchange = async () => { if (!ls.value) { await salvarAgora(); ESC = null; try { localStorage.removeItem("escala.aberta"); } catch (e) {} montarTopo(); location.hash = "#/lojas"; render(); return; } const m = LISTA.find((l) => l.loja_cod === ls.value); abrirEscala(m.id); };
  const ms = $("#mesSel"); if (ms) ms.onchange = () => abrirEscala(ms.value);
  $$("[data-tema]").forEach((b) => (b.onclick = () => aplicarTema(b.dataset.tema)));
  $("#sair").onclick = async () => { await salvarAgora(); await SB.auth.signOut(); try { localStorage.removeItem("escala.aberta"); } catch (e) {} location.hash = ""; location.reload(); };
}
function montarAbas(rota) {
  const n = VAL ? VAL.erros.length : 0;
  const abas = ESC ? [["inicio", "Início"], ["escala", "Escala do mês"], ["dia", "Dia a dia"], ["movimento", "Movimento e pessoas"], ["avisos", "O que arrumar" + (n ? ` <span class="selo-n">${n}</span>` : "")], ["mudancas", "Mudanças" + (MUD && MUD.length ? ` <span class="selo-n amarelo">${MUD.length}</span>` : "")], ["ajuda", "Como usar"]] : [];
  if (ehAdmin()) abas.unshift(["lojas", "Todas as lojas"]);
  $("#abas").innerHTML = abas.map(([k, t]) => `<a href="#/${k}" class="${k === rota ? "ativa" : ""}">${t}</a>`).join("");
}
function render() {
  let rota = (location.hash.replace(/^#\//, "") || "inicio").split("?")[0];
  if (!ESC && rota !== "lojas") rota = ehAdmin() ? "lojas" : "inicio";
  montarAbas(rota);
  const c = $("#conteudo");
  ({ lojas: telaLojas, inicio: telaInicio, escala: telaEscala, dia: telaDia, movimento: telaMovimento, avisos: telaAvisos, mudancas: telaMudancas, ajuda: telaAjuda }[rota] || telaInicio)(c);
}

/* ================= TODAS AS LOJAS (admin) ================= */
async function telaLojas(c) {
  c.innerHTML = `<section class="cartao"><h1>Todas as lojas</h1><p class="dica">Situação da escala de cada loja. Toque numa loja para abrir.</p><div id="tabLojas"><p class="dica">Conferindo as escalas...</p></div></section>`;
  if (!RESUMO) {
    const { data, error } = await SB.from("escalas").select("id,atual,padrao");
    if (error) { $("#tabLojas").innerHTML = `<p class="login-msg">${esc(error.message)}</p>`; return; }
    RESUMO = Object.fromEntries(data.map((r) => { const a = sanear(r.atual, r.padrao), v = validarTudo(a, r.padrao); return [r.id, { erros: v.erros.length, avisos: v.avisos.length, mud: mudancas(a, r.padrao).length, pessoas: a.pessoas.filter((p) => !p.fora).length }]; }));
  }
  const alvo = $("#tabLojas"); if (!alvo) return;
  const lanc = LISTA.filter((l) => l.status === "lancada").length;
  alvo.innerHTML = `<div class="numeros"><div class="numero verde"><b>${lanc}</b><span>lançadas</span></div><div class="numero amarelo"><b>${LISTA.length - lanc}</b><span>ainda não lançadas</span></div></div>
    <div class="rolagem"><table class="tab"><thead><tr><th>Loja</th><th>Mês</th><th>Situação</th><th>Pessoas</th><th>Mudanças do gerente</th><th>A arrumar</th><th>Última mexida</th></tr></thead><tbody>
    ${LISTA.map((l) => { const r = RESUMO[l.id] || {}; return `<tr class="clica" data-id="${esc(l.id)}"><td><b>${esc(l.loja_nome)}</b></td><td>${esc(mesTxt(l.mes))}</td>
      <td>${l.status === "lancada" ? `<span class="status lancada">${ic("check")} Lançada</span><br><span class="mini">${esc(quando(l.lancada_em))} · ${esc(l.lancada_por || "")}</span>` : `<span class="status rascunho">Não lançada</span>`}</td>
      <td>${r.pessoas ?? ""}</td><td>${r.mud ? r.mud : "nenhuma"}</td><td>${r.erros ? `<b style="color:var(--erro)">${r.erros}</b>` : "nada"}</td>
      <td class="mini">${esc(l.atualizado_por || "")}<br>${esc(quando(l.atualizado_em))}</td></tr>`; }).join("")}
    </tbody></table></div>`;
  $$("tr[data-id]", alvo).forEach((tr) => (tr.onclick = () => abrirEscala(tr.dataset.id)));
}

/* ================= INÍCIO ================= */
function telaInicio(c) {
  const v = VAL, lancada = ESC.status === "lancada";
  const pessoas = E.pessoas.filter((p) => !p.fora).length;
  const fer = (E.feriados || []).filter((f) => !f.fechado);
  c.innerHTML = `
  <section class="cartao">
    <div class="linha" style="justify-content:space-between;align-items:flex-start">
      <div><h1>Escala de ${esc(mesTxt(ESC.mes))}</h1><p class="dica" style="margin:0">${esc(ESC.loja_nome)} · escala 5x2 · ${pessoas} pessoas</p></div>
      ${lancada ? `<span class="status lancada">${ic("check")} Lançada</span>` : `<span class="status rascunho">Ainda não lançada</span>`}
    </div>
    ${lancada ? `<div class="faixa ok" style="margin-top:14px">${ic("cadeado")}<div>Lançada em ${esc(quando(ESC.lancada_em))} por ${esc(ESC.lancada_por || "")}. Para mudar alguma coisa, reabra.</div><span class="espaco"></span><button class="btn" id="reabrir">Reabrir para mudar</button></div>` : ""}
    <div class="numeros">
      <div class="numero ${v.erros.length ? "vermelho" : "verde"}"><b>${v.erros.length}</b><span>${v.erros.length === 1 ? "coisa para arrumar" : "coisas para arrumar"}</span></div>
      <div class="numero"><b>${MUD.length}</b><span>mudanças suas em relação à escala padrão</span></div>
      <div class="numero ${v.avisos.length ? "amarelo" : ""}"><b>${v.avisos.length}</b><span>avisos (pode lançar assim)</span></div>
    </div>
    <div class="linha">
      <a class="btn primario grande" href="#/escala">Ver e mexer na escala</a>
      ${lancada ? "" : `<button class="btn laranja grande" id="lancar">${ic("check")} Lançar escala</button>`}
      ${v.erros.length && !lancada ? `<a class="btn" href="#/avisos">Ver o que arrumar</a>` : ""}
    </div>
  </section>
  <section class="cartao">
    <h2>Como funciona</h2>
    <ol class="passos">
      <li><div><b>Veja a escala.</b> Ela já vem pronta (é a escala padrão). Cada linha é uma pessoa, cada coluna é um dia.</div></li>
      <li><div><b>Mexa no que precisar.</b> Toque num dia da pessoa para mudar o horário, dar folga ou trocar a folga de dia.</div></li>
      <li><div><b>Arrume o que ficar vermelho.</b> O site confere as regras na hora e explica o que está errado.</div></li>
      <li><div><b>Lance.</b> Com tudo certo, toque em "Lançar escala". O escritório vê que a sua loja lançou.</div></li>
    </ol>
  </section>
  ${fer.length ? `<details class="abre"><summary>Feriados do mês</summary><div>${fer.map((f) => `<p><b>${f.data.slice(8)}/${f.data.slice(5, 7)}</b> · ${esc(f.nome)}: a loja abre. Quem trabalha ganha folga em até 90 dias ou recebe em dobro (acordo coletivo, cl. 20).</p>`).join("")}</div></details>` : ""}
  ${(E.fora || []).length ? `<details class="abre"><summary>Quem não entra na escala (${E.fora.length})</summary><div><p class="dica">Afastados, aprendizes, limpeza, depósito, administrativo e outros que ficam fora da escala 5x2.</p><table class="tab"><tbody>${E.fora.map((f) => `<tr><td>${esc(f.nome)}</td><td class="mini">${esc(f.cargo || "")}</td><td class="mini">${esc(f.motivo || "")}</td></tr>`).join("")}</tbody></table></div></details>` : ""}
  <details class="abre"><summary>Horário da loja</summary><div>${E.loja.horario.map((h, w) => `<p>${DIAS_SEM[w]}: ${h ? `${esc(h[0])} às ${esc(h[1])}` : "fechada"}${w === 0 && E.loja.domingo === "diaristas" ? " (só diaristas)" : ""}</p>`).join("")}<p class="dica">A equipe pode entrar 15 min antes de abrir e sair 15 min depois de fechar.</p></div></details>`;
  const bl = $("#lancar"); if (bl) bl.onclick = confirmarLancar;
  const br = $("#reabrir"); if (br) br.onclick = confirmarReabrir;
}

/* ================= LANÇAR / REABRIR ================= */
async function confirmarLancar() {
  await salvarAgora();
  if (_erroSalvar) { toast("Antes de lançar, a escala precisa estar salva."); return; }
  const n = VAL.erros.length;
  if (n) {
    modal(`<h2>Ainda não dá para lançar</h2><p>Tem <b>${n}</b> ${n === 1 ? "coisa" : "coisas"} que quebram alguma regra (lei, acordo coletivo ou regra da empresa). Arrume antes de lançar.</p>`, [{ rotulo: "Fechar" }, { rotulo: "Ver o que arrumar", tipo: "primario", fn: () => { location.hash = "#/avisos"; } }]);
    return;
  }
  modal(`<h2>Lançar a escala de ${esc(mesTxt(ESC.mes))}?</h2>
    <p>${esc(ESC.loja_nome)} · ${E.pessoas.filter((p) => !p.fora).length} pessoas · ${MUD.length} ${MUD.length === 1 ? "mudança" : "mudanças"} em relação à escala padrão${VAL.avisos.length ? ` · ${VAL.avisos.length} avisos` : ""}.</p>
    <p class="dica">Depois de lançada, a escala fica travada. Se precisar mudar, dá para reabrir.</p>`,
  [{ rotulo: "Cancelar" }, { rotulo: "Lançar escala", tipo: "laranja", fn: async () => {
    const { error } = await SB.rpc("escala_lancar", { p_id: ESC.id });
    if (error) { toast("Não consegui lançar: " + error.message); return false; }
    await abrirEscala(ESC.id); RESUMO = null; toast("Escala lançada.");
  } }]);
}
function confirmarReabrir() {
  modal(`<h2>Reabrir a escala?</h2><p>A escala volta a poder ser mudada e deixa de aparecer como lançada até você lançar de novo.</p>`, [{ rotulo: "Cancelar" }, { rotulo: "Reabrir", tipo: "primario", fn: async () => {
    const { error } = await SB.rpc("escala_reabrir", { p_id: ESC.id });
    if (error) { toast("Não consegui reabrir: " + error.message); return false; }
    await abrirEscala(ESC.id); RESUMO = null; toast("Escala reaberta. Pode mexer.");
  } }]);
}

/* ================= ESCALA DO MÊS (grade) ================= */
function classeCel(x, c) {
  if (c.t === "T") return c.ini < 660 ? "m" : "t";
  if (c.t === "X") return "x";
  if (x.fechado) return "fech";
  return c.t === "D" ? "d" : "f";
}
function textoCel(x, c) {
  if (c.t === "T") return `<b>${hm(c.ini)}</b><span>${hm(c.fim)}</span>`;
  if (c.t === "X") return "FER";
  if (x.fechado) return "";
  return c.t === "D" ? "DOM" : "F";
}
function telaEscala(c) {
  const setores = setoresDe(E), lancada = travada();
  const errosDia = {}, avisosDia = {};
  VAL.lista.forEach((v) => { if (!v.pessoa) return; const k = v.pessoa + ":" + (v.dia ?? "x"); (v.nivel === "erro" ? errosDia : avisosDia)[k] = true; if (v.nivel === "erro") errosDia[v.pessoa] = true; });
  const mudou = {}; MUD.forEach((m) => { if (m.dia != null) mudou[m.pessoa + ":" + m.dia] = true; });
  const busca = FILTRO.busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const visiveis = E.pessoas.filter((p) => (!FILTRO.setor || p.setor === FILTRO.setor) && (!busca || p.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(busca)) && (FILTRO.so !== "erro" || errosDia[p.id]) && (FILTRO.so !== "mudou" || MUD.some((m) => m.pessoa === p.id)) && (!p.fora || FILTRO.so === "fora"));
  const conta = E.dias.map((x, i) => E.pessoas.filter((p) => !p.fora && p.dias[i].t === "T" && (!FILTRO.setor || p.setor === FILTRO.setor)).length);
  const iniSemana = (i) => i > 0 && E.dias[i].w === 1;
  let linhas = "";
  setores.concat(FILTRO.so === "fora" ? [...new Set(E.pessoas.filter((p) => p.fora).map((p) => p.setor))].filter((s) => !setores.includes(s)) : []).forEach((s) => {
    const ps = visiveis.filter((p) => p.setor === s); if (!ps.length) return;
    linhas += `<tr class="setor"><td colspan="${E.dias.length + 1}">${esc(s)} · ${ps.length}</td></tr>`;
    ps.forEach((p) => {
      linhas += `<tr class="${p.fora ? "pessoa-fora" : ""}"><td class="nome" data-p="${esc(p.id)}"><b>${esc(p.nome)}${errosDia[p.id] ? '<span class="marca-erro"></span>' : ""}</b><small>${p.horas}h${p.turno ? " · turno " + (p.turno === "M" ? "manhã" : "tarde") : ""}${p.novo ? " · incluída" : ""}${p.fora ? " · fora da escala" : ""}</small></td>`;
      E.dias.forEach((x, i) => {
        const cc = p.dias[i], k = p.id + ":" + i;
        linhas += `<td class="${iniSemana(i) ? "semana-ini" : ""}"><div class="cel ${classeCel(x, cc)}${mudou[k] ? " mudou" : ""}${errosDia[k] ? " tem-erro" : avisosDia[k] ? " tem-aviso" : ""}" data-p="${esc(p.id)}" data-i="${i}" title="${esc(p.nome)} · ${DIAS_SEM[x.w]} ${dataTxt(x)}">${textoCel(x, cc)}</div></td>`;
      });
      linhas += "</tr>";
    });
  });
  c.innerHTML = `
  ${lancada ? `<div class="faixa ok">${ic("cadeado")}<div>Escala lançada em ${esc(quando(ESC.lancada_em))}. Para mudar, reabra.</div><span class="espaco"></span><button class="btn" id="reabrir">Reabrir para mudar</button></div>` : VAL.erros.length ? `<div class="faixa erro"><b>${VAL.erros.length}</b>&nbsp;${VAL.erros.length === 1 ? "coisa para arrumar (contorno vermelho)" : "coisas para arrumar (contorno vermelho)"}<span class="espaco"></span><a class="btn" href="#/avisos">Ver lista</a></div>` : `<div class="faixa ok">${ic("check")}<div>Nenhuma regra quebrada. Pode lançar quando quiser.</div><span class="espaco"></span><button class="btn laranja" id="lancar">Lançar escala</button></div>`}
  <div class="ferramentas">
    <input class="busca" id="busca" placeholder="Procurar pessoa" value="${esc(FILTRO.busca)}" aria-label="Procurar pessoa">
    <select id="fSetor" aria-label="Setor"><option value="">Todos os setores</option>${setores.map((s) => `<option ${s === FILTRO.setor ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
    <select id="fSo" aria-label="Mostrar"><option value="">Todas as pessoas</option><option value="erro" ${FILTRO.so === "erro" ? "selected" : ""}>Só quem tem algo a arrumar</option><option value="mudou" ${FILTRO.so === "mudou" ? "selected" : ""}>Só quem eu mudei</option><option value="fora" ${FILTRO.so === "fora" ? "selected" : ""}>Mostrar quem tirei da escala</option></select>
    <span style="flex:1"></span>
    ${lancada ? "" : `<button class="btn" id="desfazer" ${DESFAZER.length ? "" : "disabled"} title="Desfazer (Ctrl+Z)">${ic("desfazer")} Desfazer</button><button class="btn" id="incluir">${ic("mais")} Incluir pessoa</button>`}
    <button class="btn" id="imprimir">${ic("imprimir")} Imprimir</button>
    <button class="btn" id="excel">${ic("baixar")} Excel</button>
  </div>
  <div class="legenda"><span><i style="background:var(--manha)"></i>manhã (entrada e saída)</span><span><i style="background:var(--tarde)"></i>tarde</span><span><i style="background:var(--folga)"></i>F = folga</span><span><i style="background:var(--dom)"></i>DOM = folga no domingo</span><span><i style="background:var(--fechado)"></i>loja fechada</span><span><i style="background:var(--laranja);width:8px;height:8px;border-radius:50%"></i>mudou do padrão</span><span><i style="box-shadow:inset 0 0 0 2px var(--erro)"></i>arrumar</span><span><i style="box-shadow:inset 0 0 0 2px var(--amarelo)"></i>aviso</span></div>
  <div class="grade-escala ${lancada ? "travada" : ""}"><table>
    <thead><tr><th class="nome">Pessoa</th>${E.dias.map((x, i) => `<th class="${x.w === 0 ? "dom" : ""} ${iniSemana(i) ? "semana-ini" : ""}">${LETRA[x.w]}<span class="n">${String(x.d).padStart(2, "0")}</span></th>`).join("")}</tr>
    <tr class="conta"><th class="nome" style="top:38px">trabalhando no dia</th>${E.dias.map((x, i) => `<th class="${iniSemana(i) ? "semana-ini" : ""}">${x.fechado ? "" : conta[i]}</th>`).join("")}</tr></thead>
    <tbody>${linhas || `<tr><td class="nome" colspan="${E.dias.length + 1}" style="padding:20px">Ninguém com esse filtro.</td></tr>`}</tbody></table></div>`;
  $("#busca").oninput = (e) => { FILTRO.busca = e.target.value; const pos = e.target.selectionStart; telaEscala(c); const b = $("#busca"); b.focus(); b.setSelectionRange(pos, pos); };
  $("#fSetor").onchange = (e) => { FILTRO.setor = e.target.value; telaEscala(c); };
  $("#fSo").onchange = (e) => { FILTRO.so = e.target.value; telaEscala(c); };
  const bd = $("#desfazer"); if (bd) bd.onclick = desfazer;
  const bi = $("#incluir"); if (bi) bi.onclick = incluirPessoa;
  const bl = $("#lancar"); if (bl) bl.onclick = confirmarLancar;
  const br = $("#reabrir"); if (br) br.onclick = confirmarReabrir;
  $("#imprimir").onclick = imprimir; $("#excel").onclick = baixarExcel;
  $(".grade-escala").onclick = (e) => {
    const cel = e.target.closest(".cel"); if (cel) { abrirCelula(cel.dataset.p, +cel.dataset.i); return; }
    const nm = e.target.closest("td.nome[data-p]"); if (nm) abrirPessoa(nm.dataset.p);
  };
}

/* ================= EDITAR UM DIA ================= */
const opcoesHora = (sel, de = 300, ate = 1440) => {
  const ms = []; for (let m = Math.ceil(de / 15) * 15; m <= ate; m += 15) ms.push(m);
  if (sel != null && !ms.includes(sel)) { ms.push(sel); ms.sort((a, b) => a - b); }
  return ms.map((m) => `<option value="${m}" ${m === sel ? "selected" : ""}>${hm(m)}${m === 1440 ? " (meia-noite)" : ""}</option>`).join("");
};
const DUR_ALM = [[0, "sem intervalo"], [15, "15 min"], [45, "45 min"], [60, "1h"], [75, "1h15"], [90, "1h30"], [105, "1h45"], [120, "2h"]];
function horarioSugerido(p, i) {
  const x = E.dias[i], o = padraoDe(p.id);
  if (o && o.dias[i].t === "T") return clone(o.dias[i]);
  const conta = {}; let melhor = null;
  p.dias.forEach((c) => { if (c.t === "T") { const k = c.ini + "-" + c.fim + "-" + (c.alm ? c.alm.join("/") : ""); conta[k] = (conta[k] || 0) + 1; if (!melhor || conta[k] > conta[melhor.k]) melhor = { k, c }; } });
  let d = melhor ? clone(melhor.c) : (() => { const ini = x.ws ?? 480, lim = limiteDia(p), alm = lim > 360 ? 120 : lim > 240 ? 15 : 0; return montarDia(ini, ini + lim + alm, null, alm); })();
  if (x.we != null && d.fim > x.we) { const dl = d.fim - x.we; d.ini -= dl; d.fim -= dl; if (d.alm) d.alm = [d.alm[0] - dl, d.alm[1] - dl]; }
  if (x.ws != null && d.ini < Math.min(x.ws, p.entradaAtual ?? 9999)) { const ini = Math.min(x.ws, p.entradaAtual ?? 9999); const dl = ini - d.ini; d.ini += dl; d.alm = d.alm ? [d.alm[0] + dl, d.alm[1] + dl] : null; d.fim = Math.min(d.fim + dl, x.we); }
  return d;
}
function abrirCelula(pid, i) {
  const p = pessoa(pid), x = E.dias[i]; if (!p) return;
  let r = clone(p.dias[i]), semana = false;
  const travar = travada() || p.fora;
  const sem = (E.semanas || []).find((S) => S.dias.includes(i));
  const desenhar = () => {
    const trab = trabDe(r), lim = limiteDia(p), alm = r.alm ? r.alm[1] - r.alm[0] : 0;
    const temp = clone(p); temp.dias[i] = r;
    if (semana && r.t === "T" && sem) sem.dias.forEach((j) => { if (j !== i && temp.dias[j].t === "T" && !E.dias[j].fechado) temp.dias[j] = ajustarParaDia(r, j, p); });
    const probs = validarPessoa(E, temp, padraoDe(p.id)).filter((v) => v.dia === i || v.dia == null || (sem && sem.dias.includes(v.dia)));
    const o = padraoDe(p.id), mudouDoPadrao = o && !mesmoDia(r, o.dias[i]);
    const pn = abrirPainel(`
      <div class="painel-topo"><button class="btn-icone" id="fechar" aria-label="Fechar">${ic("fechar")}</button><div><h2>${esc(p.nome)}</h2><p class="dica" style="margin:0">${esc(DIAS_SEM[x.w])}, ${dataTxt(x)} · ${esc(p.setor)} · ${p.horas}h por semana</p></div></div>
      ${x.fechado ? `<div class="faixa aviso">A loja está fechada neste dia${x.feriado ? " (" + esc(x.feriado) + ")" : ""}.</div>` : x.ws != null ? `<p class="dica">Loja aberta das ${hm(x.abre)} às ${hm(x.fecha)}${!x.fixo ? " · domingo só com diaristas" : ""}${x.feriado ? " · feriado: " + esc(x.feriado) : ""}</p>` : ""}
      ${travar ? `<div class="faixa ok">${ic("cadeado")} ${p.fora ? "Esta pessoa está fora da escala." : "Escala lançada: só dá para ver. Reabra para mudar."}</div>` : ""}
      ${r.t === "X" ? `<p>Feriado com a loja fechada: ninguém trabalha.</p>` : `
      <div class="escolha"><button data-t="T" class="${r.t === "T" ? "sel" : ""}" ${travar ? "disabled" : ""}>Trabalha</button><button data-t="F" class="${r.t !== "T" ? "sel" : ""}" ${travar ? "disabled" : ""}>Folga</button></div>
      ${r.t === "T" ? `
        <div class="horarios">
          <label class="campo"><span>Entrada</span><select id="hIni" ${travar ? "disabled" : ""}>${opcoesHora(r.ini, x.ws != null ? x.ws - 180 : 300, x.we ?? 1440)}</select></label>
          <label class="campo"><span>Saída</span><select id="hFim" ${travar ? "disabled" : ""}>${opcoesHora(r.fim, r.ini + 60, Math.max(x.we ?? 1440, r.fim) + 120)}</select></label>
          <label class="campo"><span>Intervalo começa</span><select id="hAlm" ${travar || !alm ? "disabled" : ""}>${opcoesHora(r.alm ? r.alm[0] : null, r.ini, r.fim)}</select></label>
          <label class="campo"><span>Intervalo dura</span><select id="hDur" ${travar ? "disabled" : ""}>${DUR_ALM.map(([m, t]) => `<option value="${m}" ${m === alm ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        </div>
        <div class="resumo-dia">Trabalha <b>${horasTxt(trab)}</b> neste dia${r.alm ? ` · intervalo das ${hm(r.alm[0])} às ${hm(r.alm[1])}` : ""}<br><span class="dica">O normal para ${p.horas}h por semana é ${horasTxt(lim)} por dia.</span>
        ${trab !== lim && !travar ? `<br><button class="btn" id="acertar" style="margin-top:8px">Acertar a saída para fechar ${horasTxt(lim)}</button>` : ""}</div>
        ${!travar && sem ? `<label class="marcar"><input type="checkbox" id="semana" ${semana ? "checked" : ""}><span>Usar este horário em todos os dias de trabalho desta semana</span></label>` : ""}
      ` : !travar && sem ? `
        <p style="margin-bottom:4px"><b>Trocar esta folga de dia</b></p><p class="dica">Toque no dia da semana em que a pessoa vai folgar no lugar deste. Ela passa a trabalhar hoje.</p>
        <div class="semana-mini">${sem.dias.map((j) => { const y = E.dias[j], cj = p.dias[j]; return `<button data-j="${j}" class="${cj.t === "T" ? "" : cj.t === "D" ? "d" : "f"} ${j === i ? "atual" : ""}" ${j === i || cj.t !== "T" || y.fechado ? "disabled" : ""}>${DIAS_CURTO[y.w]}<br><b>${String(y.d).padStart(2, "0")}</b><br>${cj.t === "T" ? hm(cj.ini) : cj.t === "D" ? "DOM" : "F"}</button>`; }).join("")}</div>` : ""}
      `}
      ${probs.length ? `<div class="lista-problemas"><p style="margin:10px 0 0"><b>Conferência das regras</b></p>${probs.map(itemProblema).join("")}</div>` : x.fechado ? "" : `<div class="faixa ok" style="margin-top:10px">${ic("check")} Nenhuma regra quebrada para esta pessoa.</div>`}
      ${!travar && r.t !== "X" ? `<div class="linha" style="margin-top:16px"><button class="btn primario grande" id="salvar" style="flex:1">Salvar</button><button class="btn grande" id="cancelar">Cancelar</button></div>${mudouDoPadrao ? `<p style="margin-top:10px"><button class="btn" id="padrao">Voltar ao padrão (${esc(diaTxt(o.dias[i]))})</button></p>` : ""}` : ""}
      <p style="margin-top:18px"><button class="btn" id="verPessoa">Ver o mês desta pessoa</button></p>`);
    $("#fechar", pn).onclick = fecharPainel;
    $("#verPessoa", pn).onclick = () => abrirPessoa(p.id);
    if (travar) return;
    $$("[data-t]", pn).forEach((b) => (b.onclick = () => { if (b.dataset.t === "T") { if (r.t !== "T") r = horarioSugerido(p, i); } else r = { t: x.w === 0 ? "D" : "F" }; desenhar(); }));
    const g = (id) => $(id, pn);
    if (g("#hIni")) g("#hIni").onchange = (e) => { const n = +e.target.value, dl = n - r.ini; r.ini = n; r.fim += dl; if (r.alm) r.alm = [r.alm[0] + dl, r.alm[1] + dl]; desenhar(); };
    if (g("#hFim")) g("#hFim").onchange = (e) => { r.fim = +e.target.value; desenhar(); };
    if (g("#hAlm")) g("#hAlm").onchange = (e) => { const n = +e.target.value, d = r.alm[1] - r.alm[0]; r.alm = [n, n + d]; desenhar(); };
    if (g("#hDur")) g("#hDur").onchange = (e) => { const d = +e.target.value, antes = r.alm ? r.alm[1] - r.alm[0] : 0; if (!d) r.alm = null; else { const a = r.alm ? r.alm[0] : Math.round((r.ini + (r.fim - r.ini) / 2 - d / 2) / 15) * 15; r.alm = [a, a + d]; } r.fim += d - antes; desenhar(); };
    if (g("#acertar")) g("#acertar").onclick = () => { r.fim = r.ini + limiteDia(p) + (r.alm ? r.alm[1] - r.alm[0] : 0); desenhar(); };
    if (g("#semana")) g("#semana").onchange = (e) => { semana = e.target.checked; desenhar(); };
    $$("[data-j]", pn).forEach((b) => (b.onclick = () => {
      const j = +b.dataset.j, de = p.dias[j];
      alterar(() => { p.dias[i] = ajustarParaDia(de, i, p); p.dias[j] = { t: E.dias[j].w === 0 ? "D" : "F" }; }, `Folga trocada para ${DIAS_CURTO[E.dias[j].w]} ${dataTxt(E.dias[j])}.`);
      abrirCelula(pid, i);
    }));
    if (g("#padrao")) g("#padrao").onclick = () => { r = clone(o.dias[i]); desenhar(); };
    g("#cancelar").onclick = fecharPainel;
    g("#salvar").onclick = () => {
      alterar(() => { p.dias[i] = r; if (semana && r.t === "T" && sem) sem.dias.forEach((j) => { if (j !== i && p.dias[j].t === "T" && !E.dias[j].fechado) p.dias[j] = ajustarParaDia(r, j, p); }); }, "Mudança salva.");
      fecharPainel();
    };
  };
  desenhar();
}
/* leva um horário para outro dia, respeitando o horário daquele dia */
function ajustarParaDia(c, j, p) {
  const y = E.dias[j], d = clone(c);
  if (d.t !== "T" || y.we == null) return d;
  if (d.fim > y.we) { const dl = d.fim - y.we, ini0 = Math.min(y.ws, p.entradaAtual ?? 9999); const mover = Math.min(dl, Math.max(0, d.ini - ini0)); d.ini -= mover; d.fim -= mover; if (d.alm) d.alm = [d.alm[0] - mover, d.alm[1] - mover]; if (d.fim > y.we) d.fim = y.we; }
  if (d.alm && d.alm[1] > d.fim - 30) { const dur = d.alm[1] - d.alm[0]; const a = Math.max(d.ini + 60, d.fim - 60 - dur); d.alm = [a, a + dur]; }
  return d;
}
function itemProblema(v) {
  const p = v.pessoa ? pessoa(v.pessoa) : null, x = v.dia != null ? E.dias[v.dia] : null;
  return `<div class="problema ${v.nivel}"><span class="bola"></span><div class="txt"><b>${esc(v.texto)}</b><small>${x && !p ? esc(DIAS_SEM[x.w]) + " " + dataTxt(x) + " · " : ""}${esc(v.explica)}</small></div></div>`;
}

/* ================= UMA PESSOA ================= */
function abrirPessoa(pid) {
  const p = pessoa(pid); if (!p) return;
  const o = padraoDe(pid), travar = travada();
  const probs = (VAL.porPessoa[pid] || []);
  const semanas = (E.semanas || []).map((S) => ({ S, min: S.dias.reduce((a, i) => a + trabDe(p.dias[i]), 0), folgas: S.dias.filter((i) => ehFolga(p.dias[i])).length }));
  const domF = E.dias.filter((x, i) => x.w === 0 && p.dias[i].t !== "T").length;
  const restr = [p.entradaAtual != null && `Hoje entra às ${hm(p.entradaAtual)}`, p.entradaMin && `Entra a partir das ${p.entradaMin}`, p.saidaMax && `Sai até as ${p.saidaMax}`, p.semDomingo && "Não trabalha domingo", p.semFeriado && "Não trabalha feriado", p.turno && `Turno da ${p.turno === "M" ? "manhã" : "tarde"}`].filter(Boolean);
  const setores = [...new Set(setoresDe(E).concat(ORDEM_SETOR.slice(0, 9)))];
  const pn = abrirPainel(`
    <div class="painel-topo"><button class="btn-icone" id="fechar" aria-label="Fechar">${ic("fechar")}</button><div><h2>${esc(p.nome)}</h2><p class="dica" style="margin:0">${esc(p.nomeCompleto || "")}${p.cargo ? " · " + esc(p.cargo) : ""}</p></div></div>
    ${p.fora ? `<div class="faixa aviso">Fora da escala${p.fora.motivo ? ": " + esc(p.fora.motivo) : ""}.</div>` : ""}
    <div class="horarios">
      <label class="campo"><span>Setor</span><select id="pSetor" ${travar ? "disabled" : ""}>${setores.map((s) => `<option ${s === p.setor ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
      <label class="campo"><span>Horas por semana</span><select id="pHoras" ${travar ? "disabled" : ""}>${[42, 36, 30, 24, 20].map((h) => `<option value="${h}" ${h === p.horas ? "selected" : ""}>${h}h</option>`).join("")}</select></label>
    </div>
    ${restr.length ? `<p class="dica"><b>Combinado:</b> ${restr.map(esc).join(" · ")}</p>` : ""}
    <h3 style="margin-top:14px">Semanas</h3>
    <table class="tab"><tbody>${semanas.map(({ S, min, folgas }) => `<tr><td>${dataTxt(E.dias[S.dias[0]])} a ${dataTxt(E.dias[S.dias[S.dias.length - 1]])}${S.cheia ? "" : ' <span class="mini">(semana incompleta)</span>'}</td><td>${horasTxt(min)}</td><td>${folgas} folga${folgas === 1 ? "" : "s"}</td></tr>`).join("")}</tbody></table>
    <p class="dica" style="margin-top:8px">Domingos de folga no mês: <b>${domF}</b></p>
    <div class="lista-problemas">${probs.length ? probs.map(itemProblema).join("") : `<div class="faixa ok">${ic("check")} Nenhuma regra quebrada.</div>`}</div>
    ${travar ? "" : `<div class="linha" style="margin-top:16px">
      ${o && !p.fora ? `<button class="btn" id="pPadrao">Voltar a pessoa ao padrão</button>` : ""}
      ${p.fora ? `<button class="btn primario" id="pVolta">Trazer de volta para a escala</button>` : p.novo ? `<button class="btn perigo" id="pApaga">Tirar esta pessoa (incluída por engano)</button>` : `<button class="btn perigo" id="pFora">Tirar da escala</button>`}
    </div>`}`);
  $("#fechar", pn).onclick = fecharPainel;
  if (travar) return;
  $("#pSetor", pn).onchange = (e) => { alterar(() => { p.setor = e.target.value; }, "Setor mudado."); abrirPessoa(pid); };
  $("#pHoras", pn).onchange = (e) => { alterar(() => { p.horas = +e.target.value; }, `Agora ${e.target.value}h por semana. Confira os horários.`); abrirPessoa(pid); };
  const bp = $("#pPadrao", pn); if (bp) bp.onclick = () => { alterar(() => { Object.assign(p, clone(o)); }, "Pessoa voltou ao padrão."); abrirPessoa(pid); };
  const bv = $("#pVolta", pn); if (bv) bv.onclick = () => { alterar(() => { delete p.fora; }, "Voltou para a escala."); abrirPessoa(pid); };
  const ba = $("#pApaga", pn); if (ba) ba.onclick = () => { alterar(() => { E.pessoas = E.pessoas.filter((q) => q.id !== pid); }, "Pessoa tirada."); fecharPainel(); };
  const bf = $("#pFora", pn); if (bf) bf.onclick = () => modal(`<h2>Tirar ${esc(p.nome)} da escala</h2><p class="dica">A pessoa some da escala deste mês (dá para trazer de volta depois).</p>
    <label class="campo"><span>Motivo</span><select id="mot"><option>Saiu da empresa</option><option>Afastada (atestado, INSS, licença)</option><option>Férias no mês</option><option>Mudou de loja</option><option>Outro</option></select></label>`,
    [{ rotulo: "Cancelar" }, { rotulo: "Tirar da escala", tipo: "primario", fn: (m) => { const mot = $("#mot", m).value; alterar(() => { p.fora = { motivo: mot }; }, "Pessoa tirada da escala."); fecharPainel(); } }]);
}

/* ================= INCLUIR PESSOA ================= */
function incluirPessoa() {
  if (travada()) return;
  const setores = [...new Set(setoresDe(E).concat(ORDEM_SETOR.slice(0, 9)))];
  modal(`<h2>Incluir pessoa</h2><p class="dica">Para quem entrou agora ou veio de outra loja. A escala dela começa igual à de um colega do mesmo setor; depois é só ajustar.</p>
    <label class="campo"><span>Nome</span><input id="nNome" placeholder="Nome e sobrenome"></label>
    <div class="horarios"><label class="campo"><span>Setor</span><select id="nSetor">${setores.map((s) => `<option>${esc(s)}</option>`).join("")}</select></label>
    <label class="campo"><span>Horas por semana</span><select id="nHoras"><option value="42">42h</option><option value="30">30h</option><option value="24">24h</option></select></label></div>
    <label class="campo"><span>Entrada de costume</span><select id="nIni">${opcoesHora(495, 300, 1320)}</select></label>`,
  [{ rotulo: "Cancelar" }, { rotulo: "Incluir", tipo: "primario", fn: (m) => {
    const nome = $("#nNome", m).value.trim(), setor = $("#nSetor", m).value, horas = +$("#nHoras", m).value, ini = +$("#nIni", m).value;
    if (nome.length < 3) { toast("Escreva o nome."); return false; }
    const base = E.pessoas.find((q) => !q.fora && q.setor === setor && q.horas === horas) || E.pessoas.find((q) => !q.fora && q.horas === horas) || E.pessoas.find((q) => !q.fora);
    const np = { id: "n" + Date.now().toString(36), nome, nomeCompleto: nome, cargo: "", setor, horas, novo: true, entradaAtual: null, turno: null, saidaMax: null, entradaMin: null, semDomingo: false, semFeriado: false, dias: [] };
    np.dias = E.dias.map((x, i) => {
      const c = base ? base.dias[i] : { t: x.w === 0 || x.w === 6 ? "F" : "T" };
      if (c.t !== "T") return clone(c);
      const lim = limiteDia(np), alm = lim > 360 ? 120 : lim > 240 ? 15 : 0;
      let d = montarDia(ini, ini + lim + alm, null, alm);
      d = ajustarParaDia(d, i, np);
      if (x.ws != null && d.ini < x.ws) { const dl = x.ws - d.ini; d.ini += dl; d.fim = Math.min(d.fim + dl, x.we); if (d.alm) d.alm = [d.alm[0] + dl, d.alm[1] + dl]; }
      return d;
    });
    alterar(() => { E.pessoas.push(np); }, `${nome} incluída.`);
    setTimeout(() => abrirPessoa(np.id), 50);
  } }]);
  setTimeout(() => { const n = $("#nNome"); if (n) n.focus(); }, 50);
}

/* ================= DIA A DIA ================= */
function telaDia(c) {
  if (DIA_SEL == null) { const hoje = new Date().toISOString().slice(0, 10); DIA_SEL = Math.max(0, E.dias.findIndex((x) => x.iso === hoje)); if (E.dias[DIA_SEL].fechado) DIA_SEL = E.dias.findIndex((x) => !x.fechado); }
  const i = DIA_SEL, x = E.dias[i];
  const ini = Math.min(x.ws ?? 480, ...E.pessoas.filter((p) => !p.fora && p.dias[i].t === "T").map((p) => p.dias[i].ini)), fim = Math.max(x.we ?? 1200, ...E.pessoas.filter((p) => !p.fora && p.dias[i].t === "T").map((p) => p.dias[i].fim));
  const h0 = Math.floor(ini / 60) * 60, h1 = Math.ceil(fim / 60) * 60, tam = h1 - h0;
  const pct = (m) => ((m - h0) / tam) * 100;
  let eixo = ""; for (let h = h0; h <= h1; h += 60) eixo += `<span style="left:${pct(h)}%">${h / 60}h</span>`;
  const setores = setoresDe(E);
  const dia = E.dias.map((y, k) => `<button class="chip-dia ${y.w === 0 ? "dom" : ""} ${k === i ? "ativo" : ""} ${y.fechado ? "fechado" : ""}" data-k="${k}"><small>${DIAS_CURTO[y.w]}</small><b>${y.d}</b></button>`).join("");
  let corpo = "";
  if (x.fechado) corpo = `<div class="faixa aviso">Loja fechada neste dia${x.feriado ? " (" + esc(x.feriado) + ")" : ""}.</div>`;
  else setores.forEach((s) => {
    const ps = E.pessoas.filter((p) => !p.fora && p.setor === s);
    const trab = ps.filter((p) => p.dias[i].t === "T").sort((a, b) => a.dias[i].ini - b.dias[i].ini);
    const dia_ = (E.diaristas || []).filter((d) => d.dia === x.d && d.setor === s);
    const folga = ps.filter((p) => p.dias[i].t !== "T");
    const nec = E.necMes && E.necMes[s] && E.necMes[s][i];
    const pr = presenca(E, i, s);
    let cob = "";
    if (pr) {
      for (let h = h0; h < h1; h += 60) {
        const ks = pr.slots.map((t, k) => (t >= h && t < h + 60 ? k : -1)).filter((k) => k >= 0);
        if (!ks.length) { cob += `<div></div>`; continue; }
        const n = Math.min(...ks.map((k) => pr.cont[k])), hi = (E.horas || []).indexOf(h / 60), pede = nec && hi >= 0 && nec[hi] != null ? Math.round(nec[hi]) : null;
        cob += `<div class="${n === 0 ? "cob-zero" : pede != null && n < pede ? "cob-pouco" : "cob-ok"}" title="${h / 60}h: ${n} na loja${pede != null ? `, o movimento pede uns ${pede}` : ""}">${n}${pede != null ? "/" + pede : ""}</div>`;
      }
    }
    corpo += `<div class="lt-setor"><h3>${esc(s)} <span class="mini">${trab.length + dia_.length} trabalhando${dia_.length ? ` (${dia_.length} diarista${dia_.length > 1 ? "s" : ""})` : ""}</span></h3>
      ${cob ? `<div class="lt-cob">${cob}</div>` : ""}
      ${trab.map((p) => { const cc = p.dias[i]; return `<div class="lt-linha"><div class="lt-nome" data-p="${esc(p.id)}">${esc(p.nome)}</div><div class="lt-pista"><div class="lt-barra" data-p="${esc(p.id)}" style="left:${pct(cc.ini)}%;width:${pct(cc.fim) - pct(cc.ini)}%">${hm(cc.ini)} às ${hm(cc.fim)}</div>${cc.alm ? `<div class="lt-almoco" style="left:${pct(cc.alm[0])}%;width:${pct(cc.alm[1]) - pct(cc.alm[0])}%"></div>` : ""}</div></div>`; }).join("")}
      ${dia_.map((d) => `<div class="lt-linha"><div class="lt-nome">Diarista</div><div class="lt-pista"><div class="lt-barra diarista" style="left:${pct(d.ini)}%;width:${pct(d.fim) - pct(d.ini)}%">${hm(d.ini)} às ${hm(d.fim)}</div></div></div>`).join("")}
      ${folga.length ? `<div class="lt-folga">De folga: ${folga.map((p) => esc(primeiroNome(p.nome))).join(", ")}</div>` : ""}</div>`;
  });
  c.innerHTML = `<section class="cartao">
    <div class="linha" style="justify-content:space-between"><h1 style="margin:0">${esc(DIAS_SEM[x.w])}, ${dataTxt(x)}</h1>
    <div class="linha"><button class="btn-icone" id="ant" aria-label="Dia anterior">${ic("esq")}</button><button class="btn-icone" id="prox" aria-label="Próximo dia">${ic("dir")}</button></div></div>
    <p class="dica">${x.fechado ? "" : `Loja aberta das ${hm(x.abre)} às ${hm(x.fecha)}${x.feriado ? " · feriado: " + esc(x.feriado) : ""}${!x.fixo ? " · domingo só com diaristas" : ""}. `}Toque numa pessoa para mudar o horário.</p>
    <div class="dias-chips">${dia}</div>
    ${x.fechado ? "" : `<p class="mini">Quadrinhos coloridos: quantas pessoas do setor estão trabalhando em cada hora (fora do intervalo) / quantas o movimento pede. Verde = ok, amarelo = abaixo do movimento, vermelho = ninguém.</p>
    <div class="lt-eixo">${eixo}</div>`}
    <div class="linha-tempo">${corpo}</div></section>`;
  $$(".chip-dia", c).forEach((b) => (b.onclick = () => { DIA_SEL = +b.dataset.k; telaDia(c); }));
  $("#ant").onclick = () => { DIA_SEL = Math.max(0, i - 1); telaDia(c); };
  $("#prox").onclick = () => { DIA_SEL = Math.min(E.dias.length - 1, i + 1); telaDia(c); };
  $$("[data-p]", c).forEach((el) => (el.onclick = () => abrirCelula(el.dataset.p, i)));
  const ativo = $(".chip-dia.ativo", c); if (ativo) ativo.scrollIntoView({ block: "nearest", inline: "center" });
}

/* ================= MOVIMENTO E PESSOAS =================
   Movimento = clientes por hora no caixa (KW). Venda = Prime, por setor. São fontes diferentes e ficam separadas.
   Pessoas necessárias = o que a escala padrão usou como meta (movimento + venda do setor, na produtividade de hoje). */
let MOV = { w: 1, setor: "" };
const VENDA_SETOR = [["Operadora", "Loja toda"], ["Reposição", "Mercearia (reposição)"], ["Açougue", "Açougue"], ["Padaria", "Padaria"], ["Hortifruti", "Hortifruti"], ["Frios", "Frios"], ["Lanchonete", "Lanchonete e cozinha"]];
const reais = (v) => (v >= 1000 ? "R$ " + (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: v >= 100000 ? 0 : 1 }) + " mil" : "R$ " + Math.round(v).toLocaleString("pt-BR"));
const num1 = (v) => (v == null ? "" : (Math.round(v * 10) / 10).toLocaleString("pt-BR"));
/* quantas pessoas do setor estão trabalhando em cada hora, na média dos dias escolhidos */
function escaladosHora(dias, setor, horas) {
  const soma = horas.map(() => 0); let n = 0;
  dias.forEach((i) => {
    const pr = presenca(E, i, setor); if (!pr) return; n++;
    horas.forEach((h, k) => { const ks = pr.slots.map((t, j) => (t >= h * 60 && t < h * 60 + 60 ? j : -1)).filter((j) => j >= 0); if (ks.length) soma[k] += ks.reduce((a, j) => a + pr.cont[j], 0) / ks.length; });
  });
  return n ? soma.map((v) => v / n) : null;
}
function corCob(e, nec) { if (nec == null || e == null) return ""; if (nec >= 0.5 && e < 0.5) return "cob-zero"; if (e < nec - 0.5) return "cob-pouco"; return "cob-ok"; }
function quadroCob(e, n, tit) { return `<div class="cob ${corCob(e, n)}" title="${esc(tit)}">${Math.round(e ?? 0)}<small>/${Math.max(0, Math.round(n))}</small></div>`; }
function telaMovimento(c) {
  const D = P.demanda || {}, horas = P.horas || [];
  const aberto = (k) => E.loja.horario[k] && !(k === 0 && E.loja.domingo === "fechado");
  if (!aberto(MOV.w)) MOV.w = 1;
  const w = MOV.w, ordemW = [1, 2, 3, 4, 5, 6, 0].filter(aberto);
  const cli = D.clientes && D.clientes[w];
  const hAb = E.loja.horario[w] ? [minDe(E.loja.horario[w][0]), minDe(E.loja.horario[w][1])] : null;
  const horasCli = cli ? cli.hora.map((v, h) => ({ h, v })).filter((x) => x.v >= 1 || (hAb && x.h * 60 + 60 > hAb[0] && x.h * 60 < hAb[1])) : [];
  const maxCli = Math.max(1, ...horasCli.map((x) => x.v));
  const pico = horasCli.reduce((a, x) => (x.v > a.v ? x : a), { v: 0, h: 0 });
  const diasW = E.dias.map((x, i) => i).filter((i) => E.dias[i].w === w && !E.dias[i].fechado);
  const setores = setoresDe(E).filter((s) => D.nec && D.nec[w] && D.nec[w][s]);
  const nomeW = DIAS_SEM[w], plural = w === 0 || w === 6 ? nomeW + "s" : nomeW + "s-feiras";
  const linhasNec = setores.map((s) => {
    const nec = D.nec[w][s], ev = escaladosHora(diasW, s, horas);
    return `<tr><th class="tc-nome">${esc(s)}</th>${horas.map((h, k) => { const n = nec[k], e = ev ? ev[k] : null; const fora = hAb && (h * 60 + 60 <= hAb[0] || h * 60 >= hAb[1]); return `<td>${fora || n == null ? "" : quadroCob(e, n, `${s} das ${h}h às ${h + 1}h: o movimento pede ${num1(n)} pessoa(s); a escala tem ${num1(e)} em média`)}</td>`; }).join("")}</tr>`;
  }).join("");
  const venda = VENDA_SETOR.filter(([k]) => D.venda && D.venda[k]).map(([k, nome]) => ({ nome, v: D.venda[k][w] || 0 }));
  const maxV = Math.max(1, ...venda.slice(1).map((x) => x.v));
  const totW = ordemW.map((k) => ({ k, v: D.venda && D.venda.Operadora ? D.venda.Operadora[k] : 0 }));
  const maxTotW = Math.max(1, ...totW.map((x) => x.v));
  const cliW = ordemW.map((k) => ({ k, v: D.clientes && D.clientes[k] ? D.clientes[k].dia : 0 }));
  const maxCliW = Math.max(1, ...cliW.map((x) => x.v));
  const f = D.fator || {};
  MOV.setor = setores.includes(MOV.setor) ? MOV.setor : setores.includes("Operadora") ? "Operadora" : setores[0] || "";
  const colunas = (lista, max, rotulo, txt) => `<div class="barras baixas">${lista.map((x) => `<div class="barra-col" title="${esc(DIAS_SEM[x.k])}: ${esc(txt(x.v))}"><span class="barra-num">${esc(rotulo(x.v))}</span><div class="barra ${x.k === w ? "" : "apagada"}" style="height:${(x.v / max) * 100}%"></div><span class="barra-eixo">${DIAS_CURTO[x.k]}</span></div>`).join("")}</div>`;
  c.innerHTML = `
  <section class="cartao"><h1>Movimento e pessoas</h1>
    <p class="dica">Quanto a loja movimenta em cada hora e quantas pessoas cada setor precisa para dar conta. Escolha o dia da semana:</p>
    <div class="dias-chips">${ordemW.map((k) => `<button class="chip-dia ${k === 0 ? "dom" : ""} ${k === w ? "ativo" : ""}" data-w="${k}" style="min-width:64px"><b style="font-size:.9rem">${DIAS_CURTO[k]}</b></button>`).join("")}</div>
  </section>

  <section class="cartao"><h2>Pessoas por hora em cada setor · ${esc(plural)}</h2>
    <p class="dica">Em cada quadrinho: <b>quantas pessoas a escala tem</b> / <b>quantas o movimento pede</b>, na média das ${esc(plural)} do mês. Já desconta o intervalo e muda na hora quando a escala é mexida.</p>
    <div class="legenda"><span><i class="cob-ok"></i>dá conta</span><span><i class="cob-pouco"></i>abaixo do que o movimento pede</span><span><i class="cob-zero"></i>ninguém, com movimento pedindo</span></div>
    ${setores.length ? `<div class="rolagem"><table class="tab-cob"><thead><tr><th></th>${horas.map((h) => `<th>${h}h</th>`).join("")}</tr></thead><tbody>${linhasNec}</tbody></table></div>` : `<p class="dica">Sem dados para este dia.</p>`}
  </section>

  <section class="cartao"><h2>Movimento no caixa por hora · ${esc(plural)}</h2>
    ${cli ? `<p class="dica">Clientes por hora no caixa (KW), média de ${cli.dias} ${esc(plural)} normais. Em média <b>${cli.dia.toLocaleString("pt-BR")} clientes por dia</b>; a hora de mais movimento é das <b>${pico.h}h às ${pico.h + 1}h</b>.</p>
    <div class="barras" role="img" aria-label="Clientes por hora">${horasCli.map((x) => `<div class="barra-col" title="${x.h}h às ${x.h + 1}h: ${Math.round(x.v)} clientes"><span class="barra-num">${x.v >= maxCli * 0.12 ? Math.round(x.v) : ""}</span><div class="barra" style="height:${(x.v / maxCli) * 100}%"></div><span class="barra-eixo">${x.h}h</span></div>`).join("")}</div>
    <details class="abre" style="margin-top:14px"><summary>Clientes por dia da semana</summary><div>${colunas(cliW, maxCliW, (v) => v.toLocaleString("pt-BR"), (v) => v.toLocaleString("pt-BR") + " clientes")}</div></details>`
    : `<p class="dica">Sem dados do caixa para esta loja.</p>`}
  </section>

  <section class="cartao"><h2>Venda por setor · ${esc(plural)}</h2>
    ${venda.length ? `<p class="dica">Venda média de um dia (Prime)${D.periodo ? `, de ${D.periodo.de.split("-").reverse().join("/")} a ${D.periodo.ate.split("-").reverse().join("/")}` : ""}. A loja toda vende em média <b>${reais(venda[0].v)}</b> numa ${esc(nomeW)}.</p>
    <div class="hbarras">${venda.slice(1).map((x) => `<div class="hbarra" title="${esc(x.nome)}: ${esc(reais(x.v))}"><span class="hb-nome">${esc(x.nome)}</span><div class="hb-pista"><div class="barra" style="width:${(x.v / maxV) * 100}%"></div></div><span class="hb-val">${reais(x.v)}</span></div>`).join("")}</div>
    ${f.util1a6 ? `<p class="dica" style="margin-top:12px">Do 1º ao 6º dia útil do mês a venda fica <b>${Math.round((f.util1a6 / (f.resto || 1) - 1) * 100)}% acima</b> do resto do mês. Por isso esses dias pedem mais gente.</p>` : ""}
    <details class="abre" style="margin-top:10px"><summary>Venda da loja por dia da semana</summary><div>${colunas(totW, maxTotW, (v) => reais(v).replace("R$ ", ""), reais)}</div></details>`
    : `<p class="dica">Sem dados de venda para esta loja.</p>`}
  </section>

  ${setores.length && P.necMes ? `<details class="abre" id="movMes"><summary>Mês inteiro, dia por dia, de um setor</summary><div>
    <p class="dica">Escala / movimento pede, em cada dia e hora do mês (já conta início de mês e feriado).</p>
    <select id="movSetor" class="busca" style="margin-bottom:10px">${setores.map((s) => `<option ${s === MOV.setor ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
    <div class="rolagem"><table class="tab-cob"><thead><tr><th></th>${horas.map((h) => `<th>${h}h</th>`).join("")}</tr></thead><tbody>${E.dias.map((x, i) => {
      const rot = `<th class="tc-nome" style="${x.w === 0 ? "color:var(--laranja)" : ""}">${DIAS_CURTO[x.w]} ${dataTxt(x)}</th>`;
      if (x.fechado) return `<tr>${rot}<td colspan="${horas.length}" class="mini">loja fechada</td></tr>`;
      const nec = (P.necMes[MOV.setor] || [])[i] || [], ev = escaladosHora([i], MOV.setor, horas) || [];
      return `<tr>${rot}${horas.map((h, k) => { const n = nec[k], e = ev[k]; const fora = h * 60 + 60 <= x.abre || h * 60 >= x.fecha; return `<td>${fora || n == null ? "" : quadroCob(e, n, `${dataTxt(x)} das ${h}h às ${h + 1}h: pede ${num1(n)}, a escala tem ${num1(e)}`)}</td>`; }).join("")}</tr>`;
    }).join("")}</tbody></table></div></div></details>` : ""}

  <details class="abre"><summary>De onde vêm esses números</summary><div>
    <p><b>Movimento:</b> clientes que passaram no caixa (KW) em cada hora, média dos dias normais (sem feriado e véspera) de 2026.</p>
    <p><b>Venda por setor:</b> venda de cada departamento no Prime, média por dia da semana no último ano.</p>
    <p><b>Pessoas que o movimento pede:</b> a produtividade que o setor tem hoje (venda por hora trabalhada), espalhada pelas horas conforme o movimento do caixa, com o mínimo de 1 operadora e 1 açougueiro com a loja aberta. É uma referência para decidir, não uma ordem.</p>
  </div></details>`;
  $$("[data-w]", c).forEach((b) => (b.onclick = () => { MOV.w = +b.dataset.w; telaMovimento(c); }));
  const ms = $("#movSetor", c); if (ms) ms.onchange = () => { MOV.setor = ms.value; telaMovimento(c); const d = $("#movMes", c); if (d) d.open = true; };
}

/* ================= O QUE ARRUMAR ================= */
function telaAvisos(c) {
  const grupo = (lista) => {
    const por = {}; lista.forEach((v) => { const k = v.pessoa || "loja"; (por[k] = por[k] || []).push(v); });
    return Object.entries(por).map(([k, vs]) => {
      const p = k === "loja" ? null : pessoa(k);
      return `<div class="problema-grupo" style="padding:6px 0 10px;border-bottom:1px solid var(--borda)">${p ? `<p style="margin:8px 0 0"><b>${esc(p.nome)}</b> <span class="mini">${esc(p.setor)}</span></p>` : ""}
        ${vs.map((v) => { const x = v.dia != null ? E.dias[v.dia] : null; return `<div class="problema ${v.nivel}"><span class="bola"></span><div class="txt"><b>${esc(v.texto)}${x && p && !/semana/.test(v.texto) ? ` · ${DIAS_CURTO[x.w]} ${dataTxt(x)}` : ""}</b><small>${x && !p ? esc(DIAS_SEM[x.w]) + " " + dataTxt(x) + " · " : ""}${esc(v.explica)}</small></div>${p && !travada() ? `<button class="btn" data-p="${esc(p.id)}" data-i="${v.dia ?? ""}">Arrumar</button>` : !p && x ? `<button class="btn" data-dia="${v.dia}">Ver o dia</button>` : ""}</div>`; }).join("")}</div>`;
    }).join("");
  };
  const cob = VAL.cobertura;
  c.innerHTML = `
  <section class="cartao"><h1>O que arrumar</h1>
    ${VAL.erros.length ? `<p class="dica">Estes pontos quebram a lei, o acordo coletivo ou uma regra da empresa. A escala só pode ser lançada quando esta lista estiver vazia.</p>${grupo(VAL.erros)}` : `<div class="faixa ok">${ic("check")} Nada para arrumar. ${travada() ? "" : "A escala pode ser lançada."}</div>`}
  </section>
  ${VAL.avisos.length ? `<details class="abre" ${VAL.erros.length ? "" : "open"}><summary>Avisos (${VAL.avisos.length}): pode lançar assim, mas vale olhar</summary><div>${grupo(VAL.avisos)}</div></details>` : ""}
  ${cob.length ? `<details class="abre"><summary>Horários sem ninguém de um setor (${cob.length})</summary><div><p class="dica">Momentos com a loja aberta em que não tem ninguém de operadora, açougue ou liderança (gerente ou fiscal), já contando os intervalos. A maioria já vinha da escala padrão por falta de gente no quadro.</p>${grupo(cob)}</div></details>` : ""}`;
  $$("[data-p]", c).forEach((b) => (b.onclick = () => (b.dataset.i === "" ? abrirPessoa(b.dataset.p) : abrirCelula(b.dataset.p, +b.dataset.i))));
  $$("[data-dia]", c).forEach((b) => (b.onclick = () => { DIA_SEL = +b.dataset.dia; location.hash = "#/dia"; }));
}

/* ================= MUDANÇAS ================= */
async function telaMudancas(c) {
  const por = {}; MUD.forEach((m) => (por[m.pessoa] = por[m.pessoa] || []).push(m));
  c.innerHTML = `<section class="cartao"><h1>Mudanças</h1>
    <p class="dica">O que foi mudado em relação à escala padrão (a que veio pronta). A escala padrão fica guardada e nunca se perde.</p>
    ${MUD.length ? Object.entries(por).map(([pid, ms]) => { const p = E.pessoas.find((q) => q.id === pid); return `<div style="padding:8px 0;border-bottom:1px solid var(--borda)"><p style="margin:4px 0"><b>${esc(p ? p.nome : pid)}</b> <span class="mini">${esc(p ? p.setor : "")}</span></p>${ms.map((m, k) => `<div class="linha" style="justify-content:space-between;padding:3px 0"><span>${esc(m.texto)}</span>${travada() ? "" : `<button class="btn" data-pid="${esc(pid)}" data-k="${k}">Desfazer</button>`}</div>`).join("")}</div>`; }).join("") : `<div class="faixa ok">${ic("check")} Nenhuma mudança. A escala está igual à padrão.</div>`}
    ${MUD.length && !travada() ? `<div class="linha" style="margin-top:16px"><button class="btn perigo" id="tudoPadrao">Voltar tudo para a escala padrão</button></div>` : ""}
  </section>
  <section class="cartao"><h2>Histórico</h2><div id="hist"><p class="dica">Carregando...</p></div></section>`;
  $$("[data-pid]", c).forEach((b) => (b.onclick = () => {
    const m = por[b.dataset.pid][+b.dataset.k], p = pessoa(m.pessoa), o = padraoDe(m.pessoa);
    alterar(() => {
      if (m.tipo === "nova") E.pessoas = E.pessoas.filter((q) => q.id !== m.pessoa);
      else if (m.tipo === "fora") delete p.fora;
      else if (m.tipo === "horas") p.horas = o.horas;
      else if (m.tipo === "setor") p.setor = o.setor;
      else if (m.tipo === "dia") p.dias[m.dia] = clone(o.dias[m.dia]);
    }, "Mudança desfeita.");
  }));
  const tp = $("#tudoPadrao"); if (tp) tp.onclick = () => modal(`<h2>Voltar tudo para a escala padrão?</h2><p>Todas as ${MUD.length} mudanças somem e a escala fica igual à que veio pronta.</p>`, [{ rotulo: "Cancelar" }, { rotulo: "Voltar tudo", tipo: "primario", fn: () => { alterar(() => { E = clone(P); }, "Escala voltou ao padrão."); } }]);
  const { data } = await SB.from("escalas_historico").select("quando,quem,acao").eq("escala_id", ESC.id).order("quando", { ascending: false }).limit(30);
  const h = $("#hist"); if (!h) return;
  const linhas = (data || []).map((r) => `<tr><td>${esc(quando(r.quando))}</td><td>${esc(r.quem || "")}</td><td>${r.acao === "lancou" ? "lançou a escala" : r.acao === "reabriu" ? "reabriu a escala" : esc(r.acao)}</td></tr>`);
  if (ESC.atualizado_por && ESC.atualizado_por !== "Escala padrão") linhas.push(`<tr><td>${esc(quando(ESC.atualizado_em))}</td><td>${esc(ESC.atualizado_por)}</td><td>última mudança salva</td></tr>`);
  h.innerHTML = linhas.length ? `<table class="tab"><tbody>${linhas.join("")}</tbody></table>` : `<p class="dica">Ainda não foi lançada.</p>`;
}

/* ================= COMO USAR ================= */
function telaAjuda(c) {
  c.innerHTML = `<section class="cartao"><h1>Como usar</h1>
    <ol class="passos">
      <li><div><b>Abra "Escala do mês".</b> Cada linha é uma pessoa, separada por setor. Cada coluna é um dia (a letra em cima é o dia da semana). Azul = trabalha de manhã, amarelo = trabalha à tarde; em cima está a entrada e embaixo a saída. F = folga. DOM = folga no domingo.</div></li>
      <li><div><b>Toque num dia para mudar.</b> Dá para escolher Trabalha ou Folga, mudar entrada, saída e intervalo, e usar o mesmo horário na semana toda.</div></li>
      <li><div><b>Trocar a folga de dia:</b> toque na folga (F) e depois no dia da semana em que a pessoa vai folgar no lugar.</div></li>
      <li><div><b>Toque no nome da pessoa</b> para ver as horas de cada semana, mudar o setor ou as horas do contrato, voltar a pessoa ao padrão ou tirar da escala (saiu, afastou).</div></li>
      <li><div><b>"Incluir pessoa"</b> serve para quem entrou agora. A escala dela começa igual à de um colega do setor.</div></li>
      <li><div><b>"Dia a dia"</b> mostra quem está na loja em cada hora, setor por setor, e se o número de pessoas dá conta do movimento.</div></li>
      <li><div><b>"O que arrumar"</b> lista o que quebra alguma regra. Tudo vermelho precisa ser arrumado antes de lançar. O amarelo é só aviso.</div></li>
      <li><div><b>"Lançar escala"</b> no Início. A escala fica travada e o escritório vê que a sua loja lançou. Para mudar depois, toque em "Reabrir".</div></li>
    </ol></section>
  <details class="abre"><summary>Regras que o site confere</summary><div>
    <p><b>Lei:</b> 42h por semana (8h24 por dia); 30h para quem era 36h; no máximo 10h no dia; 11h de descanso entre um dia e outro; intervalo de 1h a 2h para quem trabalha mais de 6h e 15 min para quem trabalha de 4h a 6h.</p>
    <p><b>Acordo coletivo:</b> intervalo de 45 min a 2h; loja fechada em 1º de janeiro, Natal e Páscoa; feriado trabalhado dá folga em até 90 dias ou pagamento em dobro.</p>
    <p><b>Empresa:</b> escala 5x2 (2 folgas por semana, no máximo 5 dias seguidos); pelo menos 2 domingos de folga no mês e nunca 2 domingos seguidos trabalhados; equipe entra no máximo 15 min antes de abrir e sai no máximo 15 min depois de fechar; os combinados de cada pessoa (horário de saída, não trabalhar domingo e outros).</p>
    <p class="dica">Isto apoia a decisão e não substitui o jurídico, o contador trabalhista ou o sindicato.</p></div></details>
  <details class="abre"><summary>Tudo fica salvo?</summary><div><p>Sim. Cada mudança é salva sozinha no banco (aparece "Salvo às ..." no topo). Dá para fechar e abrir em outro computador. A escala padrão fica guardada: em "Mudanças" você vê o que mudou e pode desfazer.</p><p>Esqueceu a senha? Fale com o escritório.</p></div></details>`;
}

/* ================= IMPRIMIR E EXCEL ================= */
const celTxt = (x, c) => (c.t === "T" ? `${hm(c.ini)}-${hm(c.fim)}` : c.t === "X" ? "FERIADO" : x.fechado ? "" : c.t === "D" ? "DOM" : "FOLGA");
function imprimir() {
  const setores = setoresDe(E);
  const cab = `<tr><th>Nome</th>${E.dias.map((x) => `<th>${LETRA[x.w]}<br>${x.d}</th>`).join("")}</tr>`;
  $("#impressao").innerHTML = `<h1>${esc(ESC.loja_nome)} · escala de ${esc(mesTxt(ESC.mes))}${ESC.status === "lancada" ? ` · lançada em ${esc(quando(ESC.lancada_em))}` : " · NÃO LANÇADA (rascunho)"}</h1>
    <table>${cab}${setores.map((s) => `<tr><td colspan="${E.dias.length + 1}" class="n"><b>${esc(s)}</b></td></tr>` + E.pessoas.filter((p) => !p.fora && p.setor === s).map((p) => `<tr><td class="n">${esc(p.nome)}${p.horas !== 42 ? ` (${p.horas}h)` : ""}</td>${E.dias.map((x, i) => { const c = p.dias[i]; return `<td class="${c.t === "T" ? "" : c.t === "D" ? "d" : "f"}">${c.t === "T" ? `${hm(c.ini)}<br>${hm(c.fim)}` : c.t === "X" ? "FER" : x.fechado ? "" : c.t === "D" ? "DOM" : "F"}</td>`; }).join("")}</tr>`).join("")).join("")}</table>
    <p style="margin-top:4px">Em cada dia: entrada em cima, saída embaixo. F = folga. DOM = folga no domingo. Impresso em ${new Date().toLocaleString("pt-BR")}.</p>`;
  window.print();
}
function baixarExcel() {
  if (!window.XLSX) { toast("O Excel ainda está carregando. Tente de novo em alguns segundos."); return; }
  const linhas = [[`${ESC.loja_nome} · escala de ${mesTxt(ESC.mes)}${ESC.status === "lancada" ? " · lançada" : " · rascunho"}`], [], ["Setor", "Nome", "Horas/semana", ...E.dias.map((x) => `${DIAS_CURTO[x.w]} ${dataTxt(x)}`)]];
  setoresDe(E).forEach((s) => E.pessoas.filter((p) => !p.fora && p.setor === s).forEach((p) => linhas.push([s, p.nome, p.horas, ...E.dias.map((x, i) => celTxt(x, p.dias[i]))])));
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 8 }, ...E.dias.map(() => ({ wch: 12 }))];
  ws["!freeze"] = { xSplit: 3, ySplit: 3 };
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Escala");
  const det = [["Nome", "Data", "Dia", "Situação", "Entrada", "Intervalo", "Volta", "Saída", "Horas"]];
  E.pessoas.filter((p) => !p.fora).forEach((p) => E.dias.forEach((x, i) => { const c = p.dias[i]; det.push([p.nome, dataTxt(x), DIAS_CURTO[x.w], c.t === "T" ? "trabalha" : c.t === "X" ? "feriado" : "folga", c.t === "T" ? hm(c.ini) : "", c.alm ? hm(c.alm[0]) : "", c.alm ? hm(c.alm[1]) : "", c.t === "T" ? hm(c.fim) : "", c.t === "T" ? horasTxt(trabDe(c)) : ""]); }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(det), "Dia a dia");
  XLSX.writeFile(wb, `Escala ${ESC.loja_nome} ${ESC.mes}.xlsx`);
}

iniciar();
