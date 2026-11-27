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
  pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',
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
  const { data, error } = await SB.from("escalas").select("id,loja_cod,loja_nome,mes,status,lancada_em,lancada_por,lancada_nome,atualizado_em,atualizado_por").order("mes", { ascending: false });
  if (error) { telaLogin("Não consegui carregar: " + error.message); return; }
  LISTA = data.sort((a, b) => (a.mes < b.mes ? 1 : a.mes > b.mes ? -1 : 0) || ORDEM_LOJAS.indexOf(a.loja_nome) - ORDEM_LOJAS.indexOf(b.loja_nome));
  if (!LISTA.length) { $("#conteudo").innerHTML = `<section class="cartao centro"><p>Ainda não tem escala para a sua loja.</p></section>`; return; }
  $("#abas").style.display = "";
  let alvo = null; try { alvo = localStorage.getItem("escala.aberta"); } catch (e) {}
  if (!LISTA.some((l) => l.id === alvo)) alvo = ehAdmin() ? null : LISTA[0].id;
  if (alvo) await abrirEscala(alvo); else { montarTopo(); if (!location.hash || location.hash === "#/") location.hash = "#/lojas"; render(); }
  if (!iniciar._ok) { iniciar._ok = true; window.addEventListener("hashchange", render); window.addEventListener("beforeunload", (e) => { if (_salvarT || _salvando || SUJO) { e.preventDefault(); e.returnValue = ""; } }); }
}
const ORDEM_LOJAS = ["SBC 1", "SBC 2", "SBC 3", "SBC 4", "SBC 5", "SL 1", "SL 2", "SL 3", "SL 4", "PA", "Locatelli 1", "Locatelli 2", "Artena", "PMN"];

/* ---------- escalas com nome ----------
   A escala padrão é fixa. O gerente pode mexer nela, mas para guardar dá um nome (ex.: "Escala 2"): vira uma escala dele.
   Escalas com nome se salvam sozinhas a cada mudança. Lançar = escolher qual escala vale. */
let VERSOES = [], ABERTA = null, SUJO = false;
const nomeAberta = () => (travada() ? ESC.lancada_nome || "Escala padrão" : ABERTA ? ABERTA.nome : "Escala padrão");
const chaveVer = () => "escala.versao." + (ESC && ESC.id);

async function abrirEscala(id, versaoId) {
  await salvarAgora();
  $("#conteudo").innerHTML = `<section class="cartao centro"><p class="dica">Abrindo a escala...</p></section>`;
  const [{ data, error }, vs] = await Promise.all([
    SB.from("escalas").select("*").eq("id", id).single(),
    SB.from("escalas_versoes").select("id,nome,criado_em,criado_por,atualizado_em,atualizado_por,versao,dados").eq("escala_id", id).order("atualizado_em", { ascending: false }),
  ]);
  if (error) { toast("Não consegui abrir: " + error.message); return; }
  ESC = data; P = data.padrao; VERSOES = vs.data || []; SUJO = false;
  ESC._erros = contarErros(P); VERSOES.forEach((v) => { v.erros = contarErros(v.dados); delete v.dados; });
  try { localStorage.setItem("escala.aberta", id); } catch (e) {}
  const i = LISTA.findIndex((l) => l.id === id); if (i >= 0) Object.assign(LISTA[i], { status: data.status, lancada_em: data.lancada_em, lancada_por: data.lancada_por, lancada_nome: data.lancada_nome });
  if (ESC.status === "lancada") { E = sanear(ESC.atual, P); ABERTA = ESC.lancada_versao ? VERSOES.find((v) => v.id === ESC.lancada_versao) || null : null; prepararTela(); return; }
  let alvo = versaoId;
  if (alvo === undefined) { try { alvo = localStorage.getItem(chaveVer()); } catch (e) {} if (!VERSOES.some((v) => v.id === alvo)) alvo = VERSOES.length ? VERSOES[0].id : null; }
  await abrirVersao(alvo || null, true);
}
async function abrirVersao(vid, inicio) {
  if (!inicio && !(await podeSairDoPadrao())) return;
  await salvarAgora();
  if (vid) {
    const { data, error } = await SB.from("escalas_versoes").select("*").eq("id", vid).single();
    if (error) { toast("Não consegui abrir: " + error.message); vid = null; }
    else { ABERTA = { id: data.id, nome: data.nome, versao: data.versao }; E = sanear(data.dados, P); const k = VERSOES.findIndex((v) => v.id === vid); if (k >= 0) Object.assign(VERSOES[k], { versao: data.versao, nome: data.nome }); }
  }
  if (!vid) { ABERTA = null; E = sanear(P, P); }
  SUJO = false;
  try { vid ? localStorage.setItem(chaveVer(), vid) : localStorage.removeItem(chaveVer()); } catch (e) {}
  prepararTela();
}
function prepararTela() {
  DESFAZER = []; DIA_SEL = null; _erroSalvar = null; _salvoEm = null; FILTRO = { setor: "", busca: "", so: "" };
  recalcular(); montarTopo();
  if (!location.hash || location.hash === "#/" || location.hash === "#/lojas") location.hash = "#/inicio"; else render();
  carregarAlertas();
}
/* mexeu na padrão e não salvou: pergunta antes de trocar de escala */
function podeSairDoPadrao() {
  if (!SUJO) return Promise.resolve(true);
  return new Promise((ok) => modal(`<h2>Guardar o que você mexeu?</h2><p>Você mudou a escala padrão e ainda não salvou. A padrão não muda: para guardar, salve com um nome.</p>`,
    [{ rotulo: "Cancelar", fn: () => ok(false) }, { rotulo: "Jogar fora", fn: () => { SUJO = false; ok(true); } }, { rotulo: "Salvar com nome", tipo: "primario", fn: async () => { const r = await salvarComNome(); ok(!!r); } }]));
}
let COB = null;
function recalcular() { VAL = validarTudo(E, P); MUD = mudancas(E, P); COB = indiceCobertura(E, P.necMes, P.horas); if (ABERTA) { const v = VERSOES.find((x) => x.id === ABERTA.id); if (v) v.erros = VAL.erros.length; } atualizarSeletor(); }
/* quantas coisas para arrumar (erros de regra) tem uma escala */
function contarErros(dados) { try { return validarTudo(sanear(dados, P), P).erros.length; } catch (e) { return 0; } }
const rotuloVer = (nome, n) => `${nome}${n ? ` 🔴 ${n}` : ""}`;
function atualizarSeletor() { const o = document.querySelector("#verSel option:checked"); if (!o) return; const v = o.value ? VERSOES.find((x) => x.id === o.value) : null; o.textContent = v ? rotuloVer(v.nome, v.erros) : rotuloVer("Escala padrão (fixa)", ESC && ESC._erros); }
const pct = (v) => (v == null ? "-" : (Math.round(v * 1000) / 10).toLocaleString("pt-BR") + "%");
const corPct = (v, bom, ok) => (v >= bom ? "verde" : v >= ok ? "amarelo" : "vermelho");

/* ================= AVISOS DO QUADRO (Senior) =================
   A Senior atualiza 4 vezes por dia. Quando alguém sai, afasta, sai de férias ou entra, o site AVISA.
   Nada muda sozinho: o gerente escolhe o que fazer em cada aviso. */
let ALERTAS = [], _alertasDe = null;
const NAO_ENTRA = /limpeza|aprendiz|motorista|entreg|dep[oó]sito|administr|empilhad|socio|sócio|escrit|financ|compras/i;
const chaveAlerta = (a) => `${a.tipo}:${a.chave}:${String(a.inicio || a.data || "").slice(0, 10)}`;
const dataBr = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
async function carregarAlertas() {
  if (!ESC) return;
  const id = ESC.id;
  const { data, error } = await SB.rpc("escala_alertas", { p_id: id });
  if (error || !ESC || ESC.id !== id) return;
  ALERTAS = (data || []).filter((a) => a.tipo !== "novo" || !NAO_ENTRA.test((a.setor || "") + " " + (a.cargo || "")));
  _alertasDe = id;
  const r = (location.hash.replace(/^#\//, "") || "inicio").split("?")[0];
  if (["inicio", "escala", "equipe"].includes(r) && !$(".fundo-painel") && !$(".modal-fundo")) render();
}
const pessoaDaChave = (ch) => E.pessoas.find((q) => q.chave != null && String(q.chave) === String(ch));
function alertasPendentes() {
  if (!E || _alertasDe !== (ESC && ESC.id)) return [];
  const vistos = new Set(E.alertasVistos || []);
  return ALERTAS.filter((a) => {
    if (vistos.has(chaveAlerta(a))) return false;
    const p = pessoaDaChave(a.chave);
    if (a.tipo === "novo") return !p;
    if (!p) return false;
    if (a.tipo === "saiu" && p.fora) return false;
    return true;
  });
}
/* setor incompleto: tem menos gente trabalhando no mês do que o quadro da escala padrão (saiu e não foi reposto) */
function setoresIncompletos() {
  if (!E || !P) return [];
  const conta = (lista, s) => lista.filter((p) => p.setor === s && !p.fora && !p.diarista && p.dias.some((c, i) => c.t === "T" || (c.t !== "A" && c.t !== "V" && !E.dias[i].fechado))).length;
  return [...new Set(P.pessoas.map((p) => p.setor))].map((s) => ({ setor: s, era: conta(P.pessoas, s), agora: conta(E.pessoas, s) })).filter((x) => x.agora < x.era).sort((a, b) => (b.era - b.agora) - (a.era - a.agora));
}
function faixaAlertas() {
  const pend = alertasPendentes(), inc = setoresIncompletos();
  if (!pend.length && !inc.length) return "";
  const conta = (t) => pend.filter((a) => a.tipo === t).length;
  const partes = [conta("saiu") && `${conta("saiu")} saiu da empresa`, conta("afastado") && `${conta("afastado")} afastado`, conta("ferias") && `${conta("ferias")} de férias`, conta("novo") && `${conta("novo")} entrou e não está na escala`].filter(Boolean);
  return `${pend.length ? `<div class="faixa aviso alerta-quadro">${ic("pessoas")}<div><b>Mudanças no quadro (Senior):</b> ${partes.join(", ")}. A escala não muda sozinha: veja e decida o que fazer.</div><span class="espaco"></span><button class="btn primario" data-alertas>Ver e decidir</button></div>` : ""}
    ${inc.length ? `<div class="faixa erro">${ic("pessoas")}<div><b>Setor incompleto, faltando gente:</b> ${inc.map((x) => `${esc(x.setor)} (${x.agora} de ${x.era}, falta${x.era - x.agora > 1 ? "m" : ""} ${x.era - x.agora})`).join(", ")}. Inclua quem entrou no lugar ou cubra com colegas e diaristas.</div><span class="espaco"></span><a class="btn" href="#/equipe">Ver equipe</a></div>` : ""}`;
}
function ligarFaixaAlertas(c) { $$("[data-alertas]", c).forEach((b) => (b.onclick = abrirAlertas)); }
function impactoTxt(antesCob, antesBur) {
  const d = Math.round((COB.geral - antesCob) * 1000) / 10, b = VAL.cobertura.length - antesBur;
  const partes = [];
  if (Math.abs(d) >= 0.1) partes.push(`cobertura geral ${d > 0 ? "subiu" : "caiu"} ${Math.abs(d).toLocaleString("pt-BR")} ponto(s), agora ${pct(COB.geral)}`);
  if (b) partes.push(`${b > 0 ? "+" : ""}${b} horário(s) sem operadora, açougue, padaria ou fiscal`);
  return partes.length ? partes.join("; ") + "." : "A cobertura não mudou.";
}
function abrirAlertas() {
  const pend = alertasPendentes(), travar = travada();
  if (!pend.length) { fecharPainel(); render(); toast("Nenhum aviso do quadro pendente."); return; }
  const iniMes = ESC.mes + "-01";
  const item = (a, k) => {
    const p = pessoaDaChave(a.chave);
    const nome = p ? p.nome : tituloBonito(a.nome);
    let txt = "", bts = [];
    if (a.tipo === "saiu") { txt = `Saiu da empresa${a.data ? " em " + dataBr(a.data) : ""}. Os dias dela na escala ficam sem ninguém.`; bts = [["tirar", "Tirar da escala"]]; }
    if (a.tipo === "afastado" || a.tipo === "ferias") {
      const per = a.inicio ? `de ${dataBr(a.inicio)}${a.fim ? " a " + dataBr(a.fim) : " sem data de volta"}` : "sem data na Senior";
      txt = `${a.tipo === "ferias" ? "Férias" : "Afastado (" + (a.situacao || "afastamento") + ")"} ${per}.`;
      bts = a.inicio ? [["marcar", a.tipo === "ferias" ? "Marcar férias nesses dias" : "Marcar afastamento nesses dias"]] : [["tirar", "Tirar da escala do mês"]];
    }
    if (a.tipo === "novo") { txt = `Entrou na Senior${a.data ? " (admissão " + dataBr(a.data) + ")" : ""}${a.cargo ? ", " + tituloBonito(a.cargo) : ""}, e não está na escala.`; bts = [["incluir", "Incluir na escala"]];
      // vagas abertas: as do mesmo setor primeiro
      const ns = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const vs = vagas().sort((x, y) => (ns(a.setor).includes(ns(y.setor)) ? 1 : 0) - (ns(a.setor).includes(ns(x.setor)) ? 1 : 0));
      if (vs.length) { txt += ` Pode ocupar uma vaga: fica com os horários e as folgas dela.`; bts = vs.map((v) => ["ocupar:" + v.id, `Ocupar a ${v.nome}`]).concat(bts); } }
    return `<div class="problema aviso"><span class="bola"></span><div class="txt"><b>${esc(nome)}</b><small>${esc(p ? p.setor : tituloBonito(a.setor || ""))} · ${esc(txt)}</small>
      ${travar ? `<small style="display:block;margin-top:4px">Escala lançada: reabra para ajustar.</small>` : `<div class="linha" style="margin-top:8px">${bts.map(([acao, rot]) => `<button class="btn primario" data-k="${k}" data-acao="${acao}">${esc(rot)}</button>`).join("")}${p ? `<button class="btn" data-k="${k}" data-acao="ver">Ver a pessoa</button>` : ""}<button class="btn" data-k="${k}" data-acao="ok">${a.tipo === "novo" ? "Não entra na escala" : "Deixar como está"}</button></div>`}</div></div>`;
  };
  const pn = abrirPainel(`<div class="painel-topo"><button class="btn-icone" id="fechar" aria-label="Fechar">${ic("fechar")}</button><div><h2>Mudanças no quadro</h2><p class="dica" style="margin:0">Vindas da Senior. Nada muda na escala sem você escolher.</p></div></div>
    ${pend.map(item).join("")}
    <details class="abre" style="margin-top:14px"><summary>Como cobrir quem faltou</summary><div><ul style="margin:0;padding-left:18px;display:grid;gap:6px">
      <li>Troque a folga de um colega do mesmo setor para o dia descoberto.</li>
      <li>Mude a entrada ou a saída de quem já está no dia para cobrir o buraco.</li>
      <li>Chame diarista para os dias mais fracos.</li>
      <li>Depois confira "O que arrumar" e o índice de cobertura no topo da escala.</li></ul></div></details>`);
  $("#fechar", pn).onclick = () => { fecharPainel(); render(); };
  $$("[data-acao]", pn).forEach((b) => (b.onclick = () => {
    const a = pend[+b.dataset.k], acao = b.dataset.acao, p = pessoaDaChave(a.chave);
    const antesCob = COB.geral, antesBur = VAL.cobertura.length;
    const visto = () => { E.alertasVistos = [...(E.alertasVistos || []), chaveAlerta(a)]; };
    if (acao === "ver") { abrirPessoa(p.id); return; }
    if (acao === "ok") { alterar(visto); abrirAlertas(); return; }
    if (acao === "incluir") { fecharPainel(); incluirPessoa({ nome: tituloBonito(a.nome), setor: a.setor, chave: a.chave }); return; }
    if (acao.startsWith("ocupar:")) {
      const v = pessoa(acao.slice(7)); if (!v) return;
      const nomeVaga = v.nome, nome = tituloBonito(a.nome), adm = a.data ? String(a.data).slice(0, 10) : null;
      alterar(() => {
        v.chave = +a.chave; v.nome = nome; v.nomeCompleto = nome; v.cargo = tituloBonito(a.cargo || ""); delete v.vaga;
        // entrou depois do dia de início da vaga: os dias antes da admissão ficam "ainda não entrou"
        aplicarInicio(v, adm && adm > (v.inicio || "") ? adm : v.inicio);
      });
      toast(`${nome} ocupou a ${nomeVaga}. ${impactoTxt(antesCob, antesBur)}`);
      abrirAlertas(); return;
    }
    if (acao === "tirar") {
      const desde = a.tipo === "saiu" && a.data && String(a.data).slice(0, 10) > iniMes ? String(a.data).slice(0, 10) : null;
      alterar(() => { if (desde) E.dias.forEach((x, i) => { if (x.iso >= desde && !x.fechado) p.dias[i] = { t: "A" }; }); else p.fora = { motivo: a.tipo === "saiu" ? "Saiu da empresa (Senior)" : "Afastado (Senior)" }; visto(); });
    }
    if (acao === "marcar") {
      const de = String(a.inicio).slice(0, 10), ate = a.fim ? String(a.fim).slice(0, 10) : "9999";
      alterar(() => { E.dias.forEach((x, i) => { if (x.iso >= de && x.iso <= ate && !x.fechado) p.dias[i] = { t: a.tipo === "ferias" ? "V" : "A" }; }); visto(); });
    }
    toast(`${p ? p.nome : ""}: feito. ${impactoTxt(antesCob, antesBur)}`);
    abrirAlertas();
  }));
}

/* faixa curta do índice na montagem da escala (atualiza a cada mudança) */
let _cobPadrao = null;
function faixaCobertura() {
  if (!COB) return "";
  if (!_cobPadrao || _cobPadrao.id !== ESC.id) _cobPadrao = { id: ESC.id, v: indiceCobertura(sanear(P, P), P.necMes, P.horas) };
  const pad = _cobPadrao.v;
  const seta = (a, b) => { const d = Math.round((a - b) * 1000) / 10; return Math.abs(d) < 0.1 ? "" : ` <span class="cob-dif ${d > 0 ? "sobe" : "desce"}">${d > 0 ? "+" : ""}${d.toLocaleString("pt-BR")}</span>`; };
  const fraco = COB.setores[0];
  return `<div class="cob-faixa" title="Índice de cobertura da escala aberta. O número pequeno é a diferença para a escala padrão.">
    <span><small>Cobertura geral</small><b class="pct ${corPct(COB.geral, 0.85, 0.75)}">${pct(COB.geral)}</b>${seta(COB.geral, pad.geral)}</span>
    <span><small>Obrigatórios juntos</small><b class="pct ${corPct(COB.obrig, 0.98, 0.9)}">${pct(COB.obrig)}</b>${seta(COB.obrig, pad.obrig)}</span>
    <span><small>Faltando no mês</small><b>${Math.round(COB.horasFaltando).toLocaleString("pt-BR")}h</b></span>
    <span><small>Sobrando no mês</small><b>${Math.round(COB.horasSobrando).toLocaleString("pt-BR")}h</b></span>
    ${fraco ? `<span><small>Setor mais fraco</small><b>${esc(fraco.setor)} ${pct(fraco.pct)}</b></span>` : ""}
  </div>`;
}
/* cartão do índice de cobertura (Início) */
function cartaoCobertura() {
  if (!COB) return "";
  const pad = indiceCobertura(sanear(P, P), P.necMes, P.horas);
  const dif = (a, b) => { const d = Math.round((a - b) * 1000) / 10; return Math.abs(d) < 0.1 ? "igual à padrão" : `${d > 0 ? "+" : ""}${d.toLocaleString("pt-BR")} pontos em relação à padrão`; };
  return `<section class="cartao"><h2>Índice de cobertura da loja</h2>
    <p class="dica">Quanto da necessidade do mês esta escala atende. Muda na hora quando a escala é mexida.</p>
    <div class="numeros">
      <div class="numero ${corPct(COB.geral, 0.85, 0.75)}"><b>${pct(COB.geral)}</b><span>cobertura geral: das pessoas que o movimento pede, hora a hora e setor por setor${ABERTA || SUJO ? ` · ${esc(dif(COB.geral, pad.geral))}` : ""}</span></div>
      <div class="numero ${corPct(COB.obrig, 0.98, 0.9)}"><b>${pct(COB.obrig)}</b><span>do tempo aberto com operadora, açougue, padaria e fiscal juntos${ABERTA || SUJO ? ` · ${esc(dif(COB.obrig, pad.obrig))}` : ""}</span></div>
      <div class="numero"><b>${Math.round(COB.horasFaltando).toLocaleString("pt-BR")}h</b><span>faltando no mês (horas em que o movimento pede mais gente)</span></div>
      <div class="numero"><b>${Math.round(COB.horasSobrando).toLocaleString("pt-BR")}h</b><span>sobrando no mês (gente além do movimento)</span></div>
    </div>
    <p class="dica">Tem hora faltando e hora sobrando ao mesmo tempo? Dá para melhorar mudando entrada, saída ou almoço para o horário de pico (veja "Movimento e pessoas").</p>
    <details class="abre"><summary>Cobertura de cada setor</summary><div><div class="hbarras">${COB.setores.map((s) => `<div class="hbarra" title="${esc(s.setor)}: ${pct(s.pct)}"><span class="hb-nome">${esc(s.setor)}</span><div class="hb-pista"><div class="barra cob-barra ${corPct(s.pct, 0.85, 0.75)}" style="width:${Math.min(100, s.pct * 100)}%"></div></div><span class="hb-val">${pct(s.pct)}</span></div>`).join("")}</div></div></details>
  </section>`;
}
/* A escala que o gerente grava pode ter qualquer coisa. Ao abrir, a estrutura do mês vem sempre do padrão
   (que só o escritório grava) e o resto é forçado para número ou texto, para nada virar código na tela. */
/* horário combinado: o banco guarda em minutos (1060) ou texto ("17:40"); vira sempre "17:40" */
function horaCombinada(v) {
  if (typeof v === "number" && isFinite(v) && v >= 0 && v <= 1440) return hm(v);
  return /^\d{2}:\d{2}$/.test(String(v || "")) ? String(v) : null;
}
function sanear(A, B) {
  const n = (v, d = null) => (v == null || v === "" || !isFinite(+v) ? d : Math.round(+v));
  const t = (v, max = 120) => String(v ?? "").slice(0, max);
  const out = clone(B);
  out.pessoas = (Array.isArray(A && A.pessoas) ? A.pessoas : B.pessoas).map((p) => ({
    id: t(p.id, 40), chave: n(p.chave), nome: t(p.nome), nomeCompleto: t(p.nomeCompleto), cargo: t(p.cargo), setor: t(p.setor, 40),
    horas: [42, 36, 30, 24, 20].includes(+p.horas) ? +p.horas : 42, turno: p.turno === "M" || p.turno === "T" ? p.turno : null,
    saidaMax: horaCombinada(p.saidaMax), entradaMin: horaCombinada(p.entradaMin),
    entradaAtual: n(p.entradaAtual), semDomingo: !!p.semDomingo, semFeriado: !!p.semFeriado, novo: !!p.novo, subGerente: !!p.subGerente,
    vaga: !!p.vaga, diarista: !!p.diarista, inicio: /^\d{4}-\d{2}-\d{2}$/.test(String(p.inicio || "")) ? String(p.inicio) : null,
    fora: p.fora ? { motivo: t(p.fora.motivo, 60) } : undefined,
    dias: B.dias.map((x, i) => {
      const c = (p.dias || [])[i] || {};
      if (c.t === "T" && n(c.ini) != null && n(c.fim) != null) { const a = Array.isArray(c.alm) && n(c.alm[0]) != null && n(c.alm[1]) != null ? [n(c.alm[0]), n(c.alm[1])] : null; return { t: "T", ini: n(c.ini), fim: n(c.fim), alm: a }; }
      return { t: ["F", "D", "X", "A", "V", "N", "L"].includes(c.t) ? c.t : p.diarista ? "L" : "F" };
    }),
  }));
  out.pessoas.forEach((p) => { if (!p.fora) delete p.fora; if (p.chave == null) delete p.chave; if (!p.vaga) delete p.vaga; if (!p.diarista) delete p.diarista; if (!p.inicio) delete p.inicio; });
  // avisos do quadro que o gerente já resolveu (só textos curtos)
  out.alertasVistos = (Array.isArray(A && A.alertasVistos) ? A.alertasVistos : []).filter((k) => typeof k === "string" && k.length < 80).slice(0, 300);
  return out;
}

/* ================= GRAVAÇÃO ================= */
function alterar(fn, msg) {
  if (travada()) { toast("Esta escala já foi lançada. Toque em \"Reabrir\" para mudar."); return false; }
  const antes = JSON.stringify(E);
  fn();
  if (JSON.stringify(E) === antes) return false;
  DESFAZER.push(antes); if (DESFAZER.length > 60) DESFAZER.shift();
  depoisDeMexer();
  if (msg) toast(msg, { rotulo: "Desfazer", fn: desfazer });
  return true;
}
function depoisDeMexer() { recalcular(); if (ABERTA) agendarSalvar(); else { SUJO = MUD.length > 0; mostrarSalvo(); if (SUJO) salvarSozinha(); } render(); }
/* mexeu na padrão: guarda na hora numa escala nova (mesmo com coisas para arrumar), para não perder nada */
let _criando = false;
async function salvarSozinha() {
  if (_criando || ABERTA || travada()) return; _criando = true;
  const nome = nomeLivre();
  const { data, error } = await SB.from("escalas_versoes").insert({ escala_id: ESC.id, nome, dados: E }).select("id,nome,criado_em,criado_por,atualizado_em,atualizado_por,versao").single();
  _criando = false;
  if (error) { toast("Não salvou sozinho: " + error.message + ". Toque em Salvar."); return; }
  data.erros = VAL.erros.length; VERSOES.unshift(data); ABERTA = { id: data.id, nome: data.nome, versao: data.versao }; SUJO = false; _salvoEm = new Date(); _erroSalvar = null;
  try { localStorage.setItem(chaveVer(), data.id); } catch (e) {}
  RESUMO = null; montarTopo();
  _salvarT = 1; await salvarAgora();
  toast(`Salva como "${data.nome}". Dá para trocar o nome no Início.`);
}
function desfazer() {
  if (travada() || !DESFAZER.length) return;
  E = JSON.parse(DESFAZER.pop()); depoisDeMexer(); toast("Desfeito.");
}
function agendarSalvar() { clearTimeout(_salvarT); _salvarT = setTimeout(salvarAgora, 900); mostrarSalvo(); }
async function salvarAgora() {
  if (!_salvarT || !ABERTA) return;
  clearTimeout(_salvarT); _salvarT = null; _salvando = true; mostrarSalvo();
  const { data, error } = await SB.from("escalas_versoes").update({ dados: E }).eq("id", ABERTA.id).eq("versao", ABERTA.versao).select("versao,atualizado_em,atualizado_por");
  _salvando = false;
  if (error) { _erroSalvar = "Não salvou"; mostrarSalvo(); toast("Não salvou: " + error.message, { rotulo: "Tentar de novo", fn: () => { _salvarT = 1; salvarAgora(); } }); return; }
  if (!data || !data.length) {
    _erroSalvar = "Não salvou"; mostrarSalvo();
    modal(`<h2>Esta escala mudou em outro lugar</h2><p>Alguém mexeu na escala "${esc(ABERTA.nome)}" em outro computador ou celular (ou lançou a escala da loja) enquanto você trabalhava. Para não apagar o que a outra pessoa fez, a sua última mudança não foi gravada.</p><p class="dica">Recarregue para ver a versão mais nova.</p>`, [{ rotulo: "Recarregar", tipo: "primario", fn: () => abrirEscala(ESC.id, ABERTA.id) }]);
    return;
  }
  ABERTA.versao = data[0].versao; _erroSalvar = null; _salvoEm = new Date(); mostrarSalvo();
  const v = VERSOES.find((x) => x.id === ABERTA.id); if (v) Object.assign(v, data[0]);
  RESUMO = null;
}
function nomeLivre(base) { let n = VERSOES.length + 2, nome; do { nome = base || `Escala ${n++}`; base = null; } while (VERSOES.some((v) => v.nome.toLowerCase() === nome.toLowerCase())); return nome; }
/* primeira vez que salva (ou "salvar como nova"): pede o nome */
function salvarComNome(copia) {
  return new Promise((ok) => {
    const m = modal(`<h2>${copia ? "Salvar como uma escala nova" : "Salvar a escala"}</h2>
      <p class="dica">${copia ? "Cria outra escala, com o que está na tela agora. A atual continua do jeito que está." : "A escala padrão não muda. O que você mexeu fica guardado numa escala sua, com o nome que você escolher."}</p>
      <label class="campo"><span>Nome da escala</span><input id="nomeEsc" maxlength="60" value="${esc(nomeLivre())}"></label>`,
    [{ rotulo: "Cancelar", fn: () => ok(null) }, { rotulo: "Salvar", tipo: "primario", fn: async (f) => {
      const nome = $("#nomeEsc", f).value.trim();
      if (!nome) { toast("Escreva um nome."); return false; }
      if (VERSOES.some((v) => v.nome.toLowerCase() === nome.toLowerCase())) { toast("Já tem uma escala com esse nome."); return false; }
      const { data, error } = await SB.from("escalas_versoes").insert({ escala_id: ESC.id, nome, dados: E }).select("id,nome,criado_em,criado_por,atualizado_em,atualizado_por,versao").single();
      if (error) { toast("Não salvou: " + error.message); return false; }
      data.erros = VAL.erros.length; VERSOES.unshift(data); ABERTA = { id: data.id, nome: data.nome, versao: data.versao }; SUJO = false; _salvoEm = new Date(); _erroSalvar = null;
      try { localStorage.setItem(chaveVer(), data.id); } catch (e) {}
      RESUMO = null; montarTopo(); render(); toast(`Salva como "${data.nome}".`); ok(data);
    } }]);
    setTimeout(() => { const i = $("#nomeEsc", m); if (i) { i.focus(); i.select(); } }, 50);
  });
}
async function botaoSalvar() { if (travada()) return; if (!ABERTA) { await salvarComNome(); return; } _salvarT = _salvarT || 1; await salvarAgora(); if (!_erroSalvar) toast(`"${ABERTA.nome}" salva.`); }
function renomearVersao(v) {
  modal(`<h2>Mudar o nome</h2><label class="campo"><span>Nome da escala</span><input id="novoNome" maxlength="60" value="${esc(v.nome)}"></label>`, [{ rotulo: "Cancelar" }, { rotulo: "Salvar", tipo: "primario", fn: async (f) => {
    const nome = $("#novoNome", f).value.trim(); if (!nome) return false;
    if (VERSOES.some((x) => x.id !== v.id && x.nome.toLowerCase() === nome.toLowerCase())) { toast("Já tem uma escala com esse nome."); return false; }
    const { data, error } = await SB.from("escalas_versoes").update({ nome }).eq("id", v.id).select("nome,versao").single();
    if (error) { toast("Não consegui: " + error.message); return false; }
    Object.assign(v, data); if (ABERTA && ABERTA.id === v.id) Object.assign(ABERTA, data);
    RESUMO = null; montarTopo(); render();
  } }]);
}
function apagarVersao(v) {
  modal(`<h2>Apagar "${esc(v.nome)}"?</h2><p>Esta escala some. A escala padrão e as outras continuam.</p>`, [{ rotulo: "Cancelar" }, { rotulo: "Apagar", tipo: "perigo", fn: async () => {
    const { error } = await SB.from("escalas_versoes").delete().eq("id", v.id);
    if (error) { toast("Não consegui apagar: " + error.message); return false; }
    VERSOES = VERSOES.filter((x) => x.id !== v.id); RESUMO = null;
    if (ABERTA && ABERTA.id === v.id) { clearTimeout(_salvarT); _salvarT = null; await abrirVersao(VERSOES.length ? VERSOES[0].id : null, true); } else { montarTopo(); render(); }
    toast("Escala apagada.");
  } }]);
}
function mostrarSalvo() {
  const el = $("#salvo"); if (!el) return;
  el.className = "salvo" + (_erroSalvar || SUJO ? " erro" : "");
  el.textContent = travada() ? "" : SUJO ? "Não salvo" : _erroSalvar || (_salvando ? "Salvando..." : _salvarT ? "Alterado" : _salvoEm ? "Salvo às " + _salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
  const b = $("#btSalvar"); if (b) b.classList.toggle("pisca", SUJO);
}

/* ================= TOPO E ABAS ================= */
function montarTopo() {
  const lojas = [...new Map(LISTA.map((l) => [l.loja_cod, l])).values()];
  const meses = ESC ? LISTA.filter((l) => l.loja_cod === ESC.loja_cod) : [];
  const tema = temaAtual();
  const seletorEscala = !ESC ? "" : travada()
    ? `<span class="loja-nome" title="Escala lançada">${ic("cadeado")} ${esc(nomeAberta())}</span>`
    : `<select class="loja-sel" id="verSel" aria-label="Escala aberta"><option value="">${esc(rotuloVer("Escala padrão (fixa)", ESC._erros))}</option>${VERSOES.map((v) => `<option value="${esc(v.id)}" ${ABERTA && ABERTA.id === v.id ? "selected" : ""}>${esc(rotuloVer(v.nome, v.erros))}</option>`).join("")}</select>
       <button class="btn-topo" id="btSalvar" title="Salvar">${ic("check")} Salvar</button>`;
  $("#topo").innerHTML = `<div class="marca"><span class="ponto"></span><span class="txt">Escalas das Lojas</span></div>
    ${ehAdmin() ? `<select class="loja-sel" id="lojaSel" aria-label="Loja"><option value="">Todas as lojas</option>${lojas.map((l) => `<option value="${esc(l.loja_cod)}" ${ESC && ESC.loja_cod === l.loja_cod ? "selected" : ""}>${esc(l.loja_nome)}</option>`).join("")}</select>` : ESC ? `<span class="loja-nome">${esc(ESC.loja_nome)}</span>` : ""}
    ${meses.length > 1 ? `<select class="loja-sel" id="mesSel" aria-label="Mês">${meses.map((m) => `<option value="${esc(m.id)}" ${m.id === ESC.id ? "selected" : ""}>${esc(mesTxt(m.mes))}</option>`).join("")}</select>` : ESC ? `<span class="loja-nome" style="opacity:.75">${esc(mesTxt(ESC.mes))}</span>` : ""}
    ${seletorEscala}
    <span class="espaco"></span><span id="salvo" class="salvo"></span>
    <div class="tema-chave" role="group" aria-label="Aparência"><button data-tema="light" class="${tema === "light" ? "sel" : ""}" title="Claro" aria-label="Modo claro">${ic("sol")}</button><button data-tema="dark" class="${tema === "dark" ? "sel" : ""}" title="Escuro" aria-label="Modo escuro">${ic("lua")}</button></div>
    <button class="btn-topo" id="sair" title="Sair">${ic("sair")}<span class="txt-sair">${esc(primeiroNome(ACESSO.nome))}</span></button>`;
  mostrarSalvo();
  const ls = $("#lojaSel"); if (ls) ls.onchange = async () => {
    if (!(await podeSairDoPadrao())) { ls.value = ESC ? ESC.loja_cod : ""; return; }
    if (!ls.value) { await salvarAgora(); ESC = null; try { localStorage.removeItem("escala.aberta"); } catch (e) {} montarTopo(); location.hash = "#/lojas"; render(); return; }
    const m = LISTA.find((l) => l.loja_cod === ls.value); abrirEscala(m.id);
  };
  const ms = $("#mesSel"); if (ms) ms.onchange = async () => { if (!(await podeSairDoPadrao())) { ms.value = ESC.id; return; } abrirEscala(ms.value); };
  const vs = $("#verSel"); if (vs) vs.onchange = () => abrirVersao(vs.value || null).then(() => { const s = $("#verSel"); if (s) s.value = ABERTA ? ABERTA.id : ""; });
  const bs = $("#btSalvar"); if (bs) bs.onclick = botaoSalvar;
  $$("[data-tema]").forEach((b) => (b.onclick = () => aplicarTema(b.dataset.tema)));
  $("#sair").onclick = async () => { if (!(await podeSairDoPadrao())) return; await salvarAgora(); await SB.auth.signOut(); try { localStorage.removeItem("escala.aberta"); } catch (e) {} location.hash = ""; location.reload(); };
}
function montarAbas(rota) {
  const n = VAL ? VAL.erros.length : 0;
  const abas = ESC ? [["inicio", "Início"], ["escala", "Escala do mês"], ...(tem6x1() ? [["6x1", "Escala 6x1"]] : []), ["dia", "Dia a dia"], ["equipe", "Equipe"], ["movimento", "Movimento e pessoas"], ["avisos", "O que arrumar" + (n ? ` <span class="selo-n">${n}</span>` : "")], ["regras", "Regras"], ["ajuda", "Como usar"]] : [];
  if (ehAdmin()) abas.unshift(["lojas", "Todas as lojas"]);
  $("#abas").innerHTML = abas.map(([k, t]) => `<a href="#/${k}" class="${k === rota ? "ativa" : ""}">${t}</a>`).join("");
}
function render() {
  let rota = (location.hash.replace(/^#\//, "") || "inicio").split("?")[0];
  if (!ESC && rota !== "lojas") rota = ehAdmin() ? "lojas" : "inicio";
  montarAbas(rota);
  const c = $("#conteudo");
  ({ lojas: telaLojas, inicio: telaInicio, escala: telaEscala, "6x1": telaSeisUm, dia: telaDia, equipe: telaEquipe, movimento: telaMovimento, avisos: telaAvisos, regras: telaRegras, ajuda: telaAjuda }[rota] || telaInicio)(c);
}

/* ================= TODAS AS LOJAS (admin) ================= */
async function telaLojas(c) {
  c.innerHTML = `<section class="cartao"><h1>Todas as lojas</h1><p class="dica">Situação da escala de cada loja. Toque numa loja para abrir.</p><div id="tabLojas"><p class="dica">Conferindo as escalas...</p></div></section>`;
  if (!RESUMO) {
    const [r1, r2] = await Promise.all([SB.from("escalas").select("id,atual,padrao,status"), SB.from("escalas_versoes").select("escala_id,nome,dados,atualizado_em,atualizado_por").order("atualizado_em", { ascending: false })]);
    const error = r1.error || r2.error;
    if (error) { $("#tabLojas").innerHTML = `<p class="login-msg">${esc(error.message)}</p>`; return; }
    RESUMO = Object.fromEntries(r1.data.map((r) => {
      const vs = r2.data.filter((v) => v.escala_id === r.id), ult = vs[0];
      const base = r.status === "lancada" ? r.atual : ult ? ult.dados : r.padrao;
      const a = sanear(base, r.padrao), v = validarTudo(a, r.padrao);
      const ic_ = indiceCobertura(a, r.padrao.necMes, r.padrao.horas) || {};
      return [r.id, { erros: v.erros.length, cob: v.cobertura.length, geral: ic_.geral, obrig: ic_.obrig, pessoas: a.pessoas.filter((p) => !p.fora).length, salvas: vs.length, ult }];
    }));
  }
  const alvo = $("#tabLojas"); if (!alvo) return;
  const lanc = LISTA.filter((l) => l.status === "lancada").length;
  alvo.innerHTML = `<div class="numeros"><div class="numero verde"><b>${lanc}</b><span>lançadas</span></div><div class="numero amarelo"><b>${LISTA.length - lanc}</b><span>ainda não lançadas</span></div></div>
    <p class="dica">Nas lojas que não lançaram, os números são da última escala que o gerente salvou (ou da padrão, se ele ainda não salvou nenhuma).</p>
    <div class="rolagem"><table class="tab"><thead><tr><th>Loja</th><th>Mês</th><th>Situação</th><th>Cobertura geral</th><th>Obrigatórios juntos</th><th>Escalas salvas</th><th>A arrumar</th><th>Horários sem setor obrigatório</th><th>Última mexida</th></tr></thead><tbody>
    ${LISTA.map((l) => { const r = RESUMO[l.id] || {}; return `<tr class="clica" data-id="${esc(l.id)}"><td><b>${esc(l.loja_nome)}</b><br><span class="mini">${r.pessoas ?? ""} pessoas</span></td><td>${esc(mesTxt(l.mes))}</td>
      <td>${l.status === "lancada" ? `<span class="status lancada">${ic("check")} Lançada</span><br><span class="mini">"${esc(l.lancada_nome || "Escala padrão")}" · ${esc(quando(l.lancada_em))} · ${esc(l.lancada_por || "")}</span>` : `<span class="status rascunho">Não lançada</span>`}</td>
      <td><span class="pct ${corPct(r.geral ?? 0, 0.85, 0.75)}">${pct(r.geral)}</span></td><td><span class="pct ${corPct(r.obrig ?? 0, 0.98, 0.9)}">${pct(r.obrig)}</span></td>
      <td>${r.salvas || "nenhuma"}</td><td>${r.erros ? `<b style="color:var(--erro)">${r.erros}</b>` : "nada"}</td><td>${r.cob ? `<b style="color:var(--erro)">${r.cob}</b>` : "nenhum"}</td>
      <td class="mini">${r.ult ? `${esc(r.ult.atualizado_por || "")} em "${esc(r.ult.nome)}"<br>${esc(quando(r.ult.atualizado_em))}` : "ninguém mexeu"}</td></tr>`; }).join("")}
    </tbody></table></div>`;
  $$("tr[data-id]", alvo).forEach((tr) => (tr.onclick = () => abrirEscala(tr.dataset.id)));
}

/* ================= INÍCIO ================= */
function telaInicio(c) {
  const v = VAL, lancada = travada();
  const pessoas = E.pessoas.filter((p) => !p.fora).length;
  const fer = (E.feriados || []).filter((f) => !f.fechado);
  c.innerHTML = `${faixaAlertas()}
  <section class="cartao">
    <div class="linha" style="justify-content:space-between;align-items:flex-start">
      <div><h1>Escala de ${esc(mesTxt(ESC.mes))}</h1><p class="dica" style="margin:0">${esc(ESC.loja_nome)} · escala 5x2 · ${pessoas} pessoas</p></div>
      ${lancada ? `<span class="status lancada">${ic("check")} Lançada</span>` : `<span class="status rascunho">Ainda não lançada</span>`}
    </div>
    ${lancada ? `<div class="faixa ok" style="margin-top:14px">${ic("cadeado")}<div>Lançada a escala <b>"${esc(nomeAberta())}"</b> em ${esc(quando(ESC.lancada_em))} por ${esc(ESC.lancada_por || "")}. Para mudar alguma coisa, reabra.</div><span class="espaco"></span><button class="btn" id="reabrir">Reabrir para mudar</button></div>`
      : `<div class="faixa ${SUJO ? "erro" : ABERTA ? "ok" : "aviso"}" style="margin-top:14px"><div>Aberta agora: <b>${esc(nomeAberta())}</b>${!ABERTA ? (SUJO ? ". Você mexeu e ainda não salvou: toque em Salvar e dê um nome." : ". Ela é fixa: se mexer, vira uma escala sua e se salva sozinha.") : ". As mudanças se salvam sozinhas."}</div>${SUJO ? `<span class="espaco"></span><button class="btn primario" id="salvarJa">Salvar com nome</button>` : ""}</div>`}
    <div class="numeros">
      <div class="numero ${v.erros.length ? "vermelho" : "verde"}"><b>${v.erros.length}</b><span>${v.erros.length === 1 ? "coisa para arrumar" : "coisas para arrumar"}</span></div>
      <div class="numero ${v.cobertura.length ? "vermelho" : "verde"}"><b>${v.cobertura.length}</b><span>horários sem operadora, açougue, padaria ou fiscal</span></div>
      <div class="numero ${v.avisos.length ? "amarelo" : ""}"><b>${v.avisos.length}</b><span>avisos (pode lançar assim)</span></div>
    </div>
    <div class="linha">
      <a class="btn primario grande" href="#/escala">Ver e mexer na escala</a>
      ${lancada ? "" : `<button class="btn laranja grande" id="lancar">${ic("check")} Lançar "${esc(nomeAberta())}"</button>`}
      ${v.erros.length && !lancada ? `<a class="btn" href="#/avisos">Ver o que arrumar</a>` : ""}
    </div>
  </section>
  ${cartaoCobertura()}
  <section class="cartao"><h2>Escalas da loja</h2>
    <p class="dica">A escala padrão é a que veio pronta e nunca muda. As outras são as que vocês salvaram.</p>
    <table class="tab"><tbody>
      <tr><td><b>Escala padrão</b>${ESC._erros ? ` <span class="selo-n" title="coisas para arrumar">${ESC._erros}</span>` : ""} <span class="mini">fixa</span>${!lancada && !ABERTA ? ' <span class="status rascunho">aberta</span>' : ""}${lancada && !ESC.lancada_versao ? ` <span class="status lancada">lançada</span>` : ""}</td><td class="mini">montada pelo escritório</td><td style="text-align:right">${!lancada && ABERTA ? `<button class="btn" data-abrir="">Abrir</button>` : ""}</td></tr>
      ${VERSOES.map((x) => `<tr><td><b>${esc(x.nome)}</b>${x.erros ? ` <span class="selo-n" title="coisas para arrumar">${x.erros}</span>` : ""}${!lancada && ABERTA && ABERTA.id === x.id ? ' <span class="status rascunho">aberta</span>' : ""}${lancada && ESC.lancada_versao === x.id ? ` <span class="status lancada">lançada</span>` : ""}</td>
        <td class="mini">${esc(x.atualizado_por || x.criado_por || "")} · ${esc(quando(x.atualizado_em))}</td>
        <td style="text-align:right;white-space:nowrap">${lancada ? "" : `${ABERTA && ABERTA.id === x.id ? "" : `<button class="btn" data-abrir="${esc(x.id)}">Abrir</button> `}<button class="btn" data-renomear="${esc(x.id)}">Renomear</button> <button class="btn perigo" data-apagar="${esc(x.id)}">Apagar</button>`}</td></tr>`).join("")}
    </tbody></table>
    ${!lancada ? `<div class="linha" style="margin-top:12px"><button class="btn" id="copiar">${ic("mais")} Salvar a aberta como uma escala nova</button></div>` : ""}
  </section>
  <section class="cartao">
    <h2>Como funciona</h2>
    <ol class="passos">
      <li><div><b>Veja a escala.</b> Ela já vem pronta (é a escala padrão, que fica fixa). Cada linha é uma pessoa, cada coluna é um dia.</div></li>
      <li><div><b>Mexa no que precisar.</b> Toque num dia da pessoa para mudar o horário, dar folga ou trocar a folga de dia.</div></li>
      <li><div><b>Tudo se salva sozinho.</b> Na primeira mexida, vira uma escala sua (ex.: "Escala 2"), mesmo que ainda tenha coisa para arrumar. Dá para trocar o nome aqui embaixo, em "Escalas da loja".</div></li>
      <li><div><b>Arrume o que ficar vermelho e lance.</b> O site confere as regras na hora. Com tudo certo, toque em "Lançar".</div></li>
    </ol>
  </section>
  <details class="abre" id="detHist"><summary>Histórico e voltar para a padrão</summary><div><div id="hist"><p class="dica">Carregando...</p></div>${!lancada && MUD.length ? `<div class="linha" style="margin-top:12px"><button class="btn perigo" id="tudoPadrao">Voltar tudo para a escala padrão</button></div>` : ""}</div></details>
  ${fer.length ? `<details class="abre"><summary>Feriados do mês</summary><div>${fer.map((f) => `<p><b>${f.data.slice(8)}/${f.data.slice(5, 7)}</b> · ${esc(f.nome)}: a loja abre. Quem trabalha ganha folga em até 90 dias ou recebe em dobro (acordo coletivo, cl. 20).</p>`).join("")}</div></details>` : ""}
  ${(E.fora || []).length ? `<details class="abre"><summary>Quem não entra na escala (${E.fora.length})</summary><div><p class="dica">Afastados, aprendizes, limpeza, depósito, administrativo e outros que ficam fora da escala 5x2.</p><table class="tab"><tbody>${E.fora.map((f) => `<tr><td>${esc(f.nome)}</td><td class="mini">${esc(f.cargo || "")}</td><td class="mini">${esc(f.motivo || "")}</td></tr>`).join("")}</tbody></table></div></details>` : ""}
  <details class="abre"><summary>Horário da loja</summary><div>${E.loja.horario.map((h, w) => `<p>${DIAS_SEM[w]}: ${h ? `${esc(h[0])} às ${esc(h[1])}` : "fechada"}${w === 0 && E.loja.domingo === "diaristas" ? " (só diaristas)" : ""}</p>`).join("")}<p class="dica">A equipe pode entrar 15 min antes de abrir e sair 15 min depois de fechar. Gerência, açougue e produção podem passar disso (fica só aviso).</p></div></details>`;
  ligarFaixaAlertas(c);
  const bl = $("#lancar"); if (bl) bl.onclick = confirmarLancar;
  const br = $("#reabrir"); if (br) br.onclick = confirmarReabrir;
  ligarHistorico(c);
  const sj = $("#salvarJa"); if (sj) sj.onclick = () => salvarComNome();
  const cp = $("#copiar"); if (cp) cp.onclick = () => salvarComNome(true);
  $$("[data-abrir]", c).forEach((b) => (b.onclick = () => abrirVersao(b.dataset.abrir || null)));
  $$("[data-renomear]", c).forEach((b) => (b.onclick = () => renomearVersao(VERSOES.find((x) => x.id === b.dataset.renomear))));
  $$("[data-apagar]", c).forEach((b) => (b.onclick = () => apagarVersao(VERSOES.find((x) => x.id === b.dataset.apagar))));
}

/* ================= LANÇAR / REABRIR ================= */
async function confirmarLancar() {
  if (SUJO) {
    modal(`<h2>Salve antes de lançar</h2><p>Você mexeu na escala padrão. Salve com um nome e depois lance.</p>`, [{ rotulo: "Cancelar" }, { rotulo: "Salvar com nome", tipo: "primario", fn: async () => { if (await salvarComNome()) confirmarLancar(); } }]);
    return;
  }
  await salvarAgora();
  if (_erroSalvar) { toast("Antes de lançar, a escala precisa estar salva."); return; }
  const n = VAL.erros.length;
  if (n) {
    modal(`<h2>Ainda não dá para lançar</h2><p>Tem <b>${n}</b> ${n === 1 ? "coisa" : "coisas"} que quebram alguma regra (lei, acordo coletivo ou regra da empresa). Arrume antes de lançar.</p>`, [{ rotulo: "Fechar" }, { rotulo: "Ver o que arrumar", tipo: "primario", fn: () => { location.hash = "#/avisos"; } }]);
    return;
  }
  modal(`<h2>Lançar "${esc(nomeAberta())}"?</h2>
    <p>${esc(ESC.loja_nome)} · ${esc(mesTxt(ESC.mes))} · ${E.pessoas.filter((p) => !p.fora).length} pessoas${VAL.avisos.length ? ` · ${VAL.avisos.length} avisos` : ""}.</p>
    ${vagas().length ? `<div class="faixa aviso"><span class="selo-vaga">VAGA</span><div>Esta escala tem ${vagas().length === 1 ? "1 vaga" : vagas().length + " vagas"} a contratar (${vagas().map((v) => esc(v.nome)).join(", ")}). Até a contratação, esses horários ficam descobertos.</div></div>` : ""}
    <p class="dica">Esta passa a ser a escala da loja no mês. Depois de lançada ela fica travada; se precisar mudar, dá para reabrir.</p>`,
  [{ rotulo: "Cancelar" }, { rotulo: "Lançar", tipo: "laranja", fn: async () => {
    const { error } = await SB.rpc("escala_lancar", { p_id: ESC.id, p_versao: ABERTA ? ABERTA.id : null });
    if (error) { toast("Não consegui lançar: " + error.message); return false; }
    await abrirEscala(ESC.id); RESUMO = null; toast("Escala lançada.");
  } }]);
}
function confirmarReabrir() {
  modal(`<h2>Reabrir a escala?</h2><p>A loja volta a poder mudar as escalas e deixa de aparecer como lançada até lançar de novo.</p>`, [{ rotulo: "Cancelar" }, { rotulo: "Reabrir", tipo: "primario", fn: async () => {
    const volta = ESC.lancada_versao || null;
    const { error } = await SB.rpc("escala_reabrir", { p_id: ESC.id });
    if (error) { toast("Não consegui reabrir: " + error.message); return false; }
    await abrirEscala(ESC.id, volta); RESUMO = null; toast("Escala reaberta. Pode mexer.");
  } }]);
}

/* ================= ESCALA DO MÊS (grade) ================= */
function classeCel(x, c) {
  if (c.t === "T") return c.ini < 660 ? "m" : "t";
  if (c.t === "X") return "x";
  if (c.t === "A") return "afa";
  if (c.t === "V") return "vac";
  if (c.t === "N" || c.t === "L") return "nao";
  if (x.fechado) return "fech";
  return c.t === "D" ? "d" : "f";
}
function textoCel(x, c) {
  if (c.t === "T") return `<b>${hm(c.ini)}</b><span>${hm(c.fim)}</span>`;
  if (c.t === "X") return "FER";
  if (c.t === "A") return "AFAST";
  if (c.t === "V") return "FÉRIAS";
  if (c.t === "N" || c.t === "L") return "";
  if (x.fechado) return "";
  return c.t === "D" ? "DOM" : "F";
}
/* vagas: pessoa que ainda vai ser contratada ("colaborador fantasma") */
const vagas = () => E.pessoas.filter((p) => p.vaga && !p.fora);
/* diaristas incluídos pelo gerente: pessoa de fora paga pelo dia, para cobrir dias ou horários */
const diaristasQ = () => E.pessoas.filter((p) => p.diarista && !p.fora);
const SELO_DIARISTA = '<span class="selo-diarista">DIARISTA</span>';
const seloDe = (p) => (p.vaga ? '<span class="selo-vaga">VAGA</span>' : p.diarista ? SELO_DIARISTA : "");
const diasDoDiarista = (p) => E.dias.filter((x, i) => p.dias[i].t === "T").length;
function proximoNomeDiarista(setor) {
  let k = 1; while (E.pessoas.some((p) => p.nome === `Diarista ${setor} ${k}`)) k++;
  return `Diarista ${setor} ${k}`;
}
const isoBr = (iso) => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "";
/* colega que serve de modelo de folgas: mesmo setor e mesmas horas */
const colegaModelo = (setor, horas, semId) => { const ok = (q) => !q.fora && !q.vaga && !q.diarista && q.id !== semId; return E.pessoas.find((q) => ok(q) && q.setor === setor && q.horas === horas) || E.pessoas.find((q) => ok(q) && q.horas === horas) || E.pessoas.find(ok); };
function aplicarInicio(p, iso) {
  // antes do dia de início fica "ainda não entrou"; dias que voltam a valer seguem as folgas de um colega do setor
  p.inicio = iso && iso > E.dias[0].iso ? iso : null;
  const base = colegaModelo(p.setor, p.horas, p.id);
  // folga fixa que a pessoa já tem (dia útil que mais aparece como folga) para manter nos dias que voltam
  const cnt = {}; p.dias.forEach((c, i) => { const w = E.dias[i].w; if (c.t === "F" && w >= 1 && w <= 5) cnt[w] = (cnt[w] || 0) + 1; });
  const fixa = +(Object.entries(cnt).sort((a, b) => b[1] - a[1])[0] || [0])[0];
  const voltou = p.dias.some((c, i) => c.t === "N" && !(p.inicio && E.dias[i].iso < p.inicio));
  E.dias.forEach((x, i) => {
    if (p.inicio && x.iso < p.inicio) { p.dias[i] = x.fechado && p.dias[i].t === "X" ? p.dias[i] : { t: "N" }; return; }
    if (p.dias[i].t !== "N") return;
    const c = base ? base.dias[i] : { t: x.w === 0 ? "D" : "T" };
    p.dias[i] = c.t === "T" ? horarioSugerido(p, i) : c.t === "A" || c.t === "V" || c.t === "N" ? { t: x.w === 0 ? "D" : "F" } : clone(c);
  });
  if (voltou && fixa) moverFolgaFixa(p, fixa);
  if (!voltou) return;
  // garante 2 folgas por semana (5x2) nas semanas que voltaram: folga no dia fixo primeiro, depois no dia útil que quebra a maior sequência
  (E.semanas || []).forEach((S) => {
    let falta = 2 - S.dias.filter((i) => ehFolga(p.dias[i]) || AUSENCIA.includes(p.dias[i].t)).length;
    while (falta > 0) {
      const livres = S.dias.filter((i) => p.dias[i].t === "T" && E.dias[i].w >= 1 && E.dias[i].w <= 5);
      if (!livres.length) break;
      const k = livres.find((i) => E.dias[i].w === fixa && !S.dias.some((q) => q !== i && p.dias[q].t === "F" && E.dias[q].w === fixa)) ?? livres[Math.floor(livres.length / 2)];
      p.dias[k] = { t: "F" }; falta--;
    }
  });
}
function proximoNomeVaga(setor) {
  let k = 1; while (E.pessoas.some((p) => p.nome === `Vaga ${setor} ${k}`)) k++;
  return `Vaga ${setor} ${k}`;
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
      linhas += `<tr class="${p.fora ? "pessoa-fora" : ""}${p.vaga ? " linha-vaga" : ""}${p.diarista ? " linha-diarista" : ""}"><td class="nome" data-p="${esc(p.id)}"><b>${seloDe(p)}${esc(p.nome)}${errosDia[p.id] ? '<span class="marca-erro"></span>' : ""}</b><small>${p.diarista ? `${diasDoDiarista(p)} ${diasDoDiarista(p) === 1 ? "dia" : "dias"} no mês · até 8h por dia` : p.horas + "h"}${p.turno ? " · turno " + (p.turno === "M" ? "manhã" : "tarde") : ""}${p.vaga ? (p.inicio ? " · começa " + isoBr(p.inicio) : " · a contratar") : p.diarista ? "" : p.novo ? " · incluída" : ""}${p.fora ? " · fora da escala" : ""}</small></td>`;
      E.dias.forEach((x, i) => {
        const cc = p.dias[i], k = p.id + ":" + i;
        linhas += `<td class="${iniSemana(i) ? "semana-ini" : ""}"><div class="cel ${classeCel(x, cc)}${mudou[k] ? " mudou" : ""}${errosDia[k] ? " tem-erro" : avisosDia[k] ? " tem-aviso" : ""}" data-p="${esc(p.id)}" data-i="${i}" title="${esc(p.nome)} · ${DIAS_SEM[x.w]} ${dataTxt(x)}">${textoCel(x, cc)}</div></td>`;
      });
      linhas += "</tr>";
    });
  });
  c.innerHTML = `
  ${lancada ? `<div class="faixa ok">${ic("cadeado")}<div>Escala lançada em ${esc(quando(ESC.lancada_em))}. Para mudar, reabra.</div><span class="espaco"></span><button class="btn" id="reabrir">Reabrir para mudar</button></div>` : VAL.erros.length ? `<div class="faixa erro"><b>${VAL.erros.length}</b>&nbsp;${VAL.erros.length === 1 ? "coisa para arrumar (contorno vermelho)" : "coisas para arrumar (contorno vermelho)"}<span class="espaco"></span><a class="btn" href="#/avisos">Ver lista</a></div>` : `<div class="faixa ok">${ic("check")}<div>Nenhuma regra quebrada. Pode lançar quando quiser.</div><span class="espaco"></span><button class="btn laranja" id="lancar">Lançar escala</button></div>`}
  ${faixaAlertas()}
  ${faixaCobertura()}
  <div class="ferramentas">
    <input class="busca" id="busca" placeholder="Procurar pessoa" value="${esc(FILTRO.busca)}" aria-label="Procurar pessoa">
    <select id="fSetor" aria-label="Setor"><option value="">Todos os setores</option>${setores.map((s) => `<option ${s === FILTRO.setor ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
    <select id="fSo" aria-label="Mostrar"><option value="">Todas as pessoas</option><option value="erro" ${FILTRO.so === "erro" ? "selected" : ""}>Só quem tem algo a arrumar</option><option value="mudou" ${FILTRO.so === "mudou" ? "selected" : ""}>Só quem eu mudei</option><option value="fora" ${FILTRO.so === "fora" ? "selected" : ""}>Mostrar quem tirei da escala</option></select>
    <span style="flex:1"></span>
    ${lancada ? "" : `<button class="btn" id="desfazer" ${DESFAZER.length ? "" : "disabled"} title="Desfazer (Ctrl+Z)">${ic("desfazer")} Desfazer</button><button class="btn" id="incluir">${ic("mais")} Incluir pessoa</button>`}
    <button class="btn" id="imprimir">${ic("imprimir")} Imprimir</button>
    <button class="btn" id="excel">${ic("baixar")} Excel</button>
  </div>
  <div class="legenda"><span><i style="background:var(--manha)"></i>manhã (entrada e saída)</span><span><i style="background:var(--tarde)"></i>tarde</span><span><i style="background:var(--folga)"></i>F = folga</span><span><i style="background:var(--dom)"></i>DOM = folga no domingo</span><span><i style="background:var(--afa)"></i>AFAST = afastado</span><span><i style="background:var(--vac)"></i>FÉRIAS</span><span><i style="background:var(--fechado)"></i>loja fechada</span>${vagas().length ? `<span><i style="border:1.5px dashed var(--laranja);background:transparent"></i>VAGA = ainda vai contratar</span>` : ""}${diaristasQ().length ? `<span>${SELO_DIARISTA}– = o diarista não vem</span>` : ""}<span><i style="background:var(--laranja);width:8px;height:8px;border-radius:50%"></i>mudou do padrão</span><span><i style="box-shadow:inset 0 0 0 2px var(--erro)"></i>arrumar</span><span><i style="box-shadow:inset 0 0 0 2px var(--amarelo)"></i>aviso</span></div>
  <div class="grade-escala ${lancada ? "travada" : ""}"><table>
    <thead><tr><th class="nome">Pessoa</th>${E.dias.map((x, i) => `<th class="${x.w === 0 ? "dom" : ""} ${iniSemana(i) ? "semana-ini" : ""}">${LETRA[x.w]}<span class="n">${String(x.d).padStart(2, "0")}</span></th>`).join("")}</tr>
    <tr class="conta"><th class="nome" style="top:38px">trabalhando no dia</th>${E.dias.map((x, i) => `<th class="${iniSemana(i) ? "semana-ini" : ""}">${x.fechado ? "" : conta[i]}</th>`).join("")}</tr></thead>
    <tbody>${linhas || `<tr><td class="nome" colspan="${E.dias.length + 1}" style="padding:20px">Ninguém com esse filtro.</td></tr>`}</tbody></table></div>`;
  $("#busca").oninput = (e) => { FILTRO.busca = e.target.value; const pos = e.target.selectionStart; telaEscala(c); const b = $("#busca"); b.focus(); b.setSelectionRange(pos, pos); };
  $("#fSetor").onchange = (e) => { FILTRO.setor = e.target.value; telaEscala(c); };
  $("#fSo").onchange = (e) => { FILTRO.so = e.target.value; telaEscala(c); };
  const bd = $("#desfazer"); if (bd) bd.onclick = desfazer;
  const bi = $("#incluir"); if (bi) bi.onclick = () => incluirPessoa();
  ligarFaixaAlertas(c);
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
/* horário digitado: aceita "0830", "830", "8:30", "8" */
function lerHora(txt) {
  const t = String(txt || "").trim().toLowerCase().replace("h", ":"); if (!t) return null;
  if (t.includes(":")) { const [hh, mm] = t.split(":"); const h = +hh || 0, m = +(mm || 0); if (!/^\d{1,2}$/.test(hh) || !/^\d{0,2}$/.test(mm || "") || h > 24 || m > 59 || (h === 24 && m > 0)) return NaN; return h * 60 + m; }
  const d = t.replace(/\D/g, ""); if (!d) return NaN;
  let h, m;
  if (d.length <= 2) { h = +d; m = 0; } else if (d.length === 3) { h = +d[0]; m = +d.slice(1); } else { h = +d.slice(0, 2); m = +d.slice(2, 4); }
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return NaN;
  return h * 60 + m;
}
const campoHora = (id, v, travar) => `<input id="${id}" class="hora" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="--:--" value="${v == null ? "" : hm(v)}" ${travar ? "disabled" : ""}>`;
function ligarHora(el, atual, fn, podeVazio) {
  if (!el) return;
  el.oninput = () => { const v = el.value.replace(/[^\d:h]/gi, ""); if (v !== el.value) el.value = v; };
  el.onfocus = () => el.select();
  el.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); el.blur(); } };
  el.onchange = () => {
    const n = lerHora(el.value);
    if (n == null && !podeVazio) { el.value = hm(atual); return; }
    if (Number.isNaN(n)) { toast("Horário inválido. Digite assim: 0830 ou 08:30."); el.value = atual == null ? "" : hm(atual); return; }
    fn(n);
  };
}
const DUR_ALM = [[0, "sem intervalo"], [15, "15 min"], [45, "45 min"], [60, "1h"], [75, "1h15"], [90, "1h30"], [105, "1h45"], [120, "2h"]];
function horarioSugerido(p, i) {
  const x = E.dias[i], o = padraoDe(p.id);
  if (o && o.dias[i].t === "T") return clone(o.dias[i]);
  const conta = {}; let melhor = null;
  p.dias.forEach((c) => { if (c.t === "T") { const k = c.ini + "-" + c.fim + "-" + (c.alm ? c.alm.join("/") : ""); conta[k] = (conta[k] || 0) + 1; if (!melhor || conta[k] > conta[melhor.k]) melhor = { k, c }; } });
  let d = melhor ? clone(melhor.c) : (() => { const ini = x.ws ?? 480, lim = limiteDia(p), alm = lim > 360 ? (p.diarista ? 60 : 120) : lim > 240 ? 15 : 0; return montarDia(ini, ini + lim + alm, null, alm); })();
  if (x.we != null && d.fim > x.we) { const dl = d.fim - x.we; d.ini -= dl; d.fim -= dl; if (d.alm) d.alm = [d.alm[0] - dl, d.alm[1] - dl]; }
  if (x.ws != null && d.ini < Math.min(x.ws, p.entradaAtual ?? 9999)) { const ini = Math.min(x.ws, p.entradaAtual ?? 9999); const dl = ini - d.ini; d.ini += dl; d.alm = d.alm ? [d.alm[0] + dl, d.alm[1] + dl] : null; d.fim = Math.min(d.fim + dl, x.we); }
  return d;
}
function abrirCelula(pid, i) {
  const p = pessoa(pid), x = E.dias[i]; if (!p) return;
  let r = clone(p.dias[i]), alcance = ""; // "" só este dia · "semana" · "mes" · "wd" (diarista: todo <dia da semana> do mês)
  const travar = travada() || p.fora;
  const sem = (E.semanas || []).find((S) => S.dias.includes(i));
  // outros dias que recebem o mesmo horário
  const alvos = () => {
    const ok = (j) => j !== i && !E.dias[j].fechado;
    if (alcance === "semana" && sem) return sem.dias.filter((j) => ok(j) && p.dias[j].t === "T");
    if (alcance === "mes") return E.dias.map((y, j) => j).filter((j) => ok(j) && p.dias[j].t === "T");
    if (alcance === "wd") return E.dias.map((y, j) => j).filter((j) => ok(j) && E.dias[j].w === x.w && ["T", "L", "F", "D"].includes(p.dias[j].t));
    return [];
  };
  const nTrab = (lista) => lista.length + 1;
  const desenhar = () => {
    const trab = trabDe(r), lim = limiteDia(p), alm = r.alm ? r.alm[1] - r.alm[0] : 0;
    const temp = clone(p); temp.dias[i] = r;
    const outros = r.t === "T" ? alvos() : [];
    outros.forEach((j) => { temp.dias[j] = ajustarParaDia(r, j, p); });
    const probs = validarPessoa(E, temp, padraoDe(p.id)).filter((v) => v.dia === i || v.dia == null || (sem && sem.dias.includes(v.dia)) || outros.includes(v.dia));
    const o = padraoDe(p.id), mudouDoPadrao = o && !mesmoDia(r, o.dias[i]);
    const pn = abrirPainel(`
      <div class="painel-topo"><button class="btn-icone" id="fechar" aria-label="Fechar">${ic("fechar")}</button><div><h2>${esc(p.nome)}</h2><p class="dica" style="margin:0">${esc(DIAS_SEM[x.w])}, ${dataTxt(x)} · ${esc(p.setor)} · ${p.diarista ? "diarista (até 8h no dia)" : p.horas + "h por semana"}</p></div></div>
      ${x.fechado ? `<div class="faixa aviso">A loja está fechada neste dia${x.feriado ? " (" + esc(x.feriado) + ")" : ""}.</div>` : x.ws != null ? `<p class="dica">Loja aberta das ${hm(x.abre)} às ${hm(x.fecha)}${!x.fixo ? " · domingo só com diaristas" : ""}${x.feriado ? " · feriado: " + esc(x.feriado) : ""}</p>` : ""}
      ${travar ? `<div class="faixa ok">${ic("cadeado")} ${p.fora ? "Esta pessoa está fora da escala." : "Escala lançada: só dá para ver. Reabra para mudar."}</div>` : ""}
      ${r.t === "X" ? `<p>Feriado com a loja fechada: ninguém trabalha.</p>` : p.diarista ? `
      <div class="escolha"><button data-t="T" class="${r.t === "T" ? "sel" : ""}" ${travar ? "disabled" : ""}>Vem trabalhar</button><button data-t="L" class="${r.t !== "T" ? "sel" : ""}" ${travar ? "disabled" : ""}>Não vem</button></div>
      ${r.t !== "T" ? `<p class="dica">Diarista: toque em "Vem trabalhar" para cobrir este dia.</p>` : ""}
      ${r.t === "T" ? `
        <div class="horarios">
          <label class="campo"><span>Entrada</span>${campoHora("hIni", r.ini, travar)}</label>
          <label class="campo"><span>Saída</span>${campoHora("hFim", r.fim, travar)}</label>
          <label class="campo"><span>Intervalo começa</span>${campoHora("hAlm", r.alm ? r.alm[0] : null, travar)}</label>
          <label class="campo"><span>Intervalo termina</span>${campoHora("hAlmFim", r.alm ? r.alm[1] : null, travar)}</label>
        </div>
        <p class="mini" style="margin:-4px 0 0">Digite os horários com números (ex.: 0830 vira 08:30). Sem intervalo: deixe os dois campos do intervalo em branco.</p>
        <div class="resumo-dia">Trabalha <b>${horasTxt(trab)}</b> neste dia${r.alm ? ` · intervalo das ${hm(r.alm[0])} às ${hm(r.alm[1])}` : ""}<br><span class="dica">O diarista trabalha até 8h no dia.</span></div>
        ${!travar ? `<div class="alcance">
          <label class="marcar"><input type="checkbox" data-alc="wd" ${alcance === "wd" ? "checked" : ""}><span>Vir em <b>todos os ${x.w === 0 || x.w === 6 ? esc(DIAS_SEM[x.w]) + "s" : esc(DIAS_SEM[x.w]) + "s-feiras"}</b> deste mês com este horário</span></label>
          <label class="marcar"><input type="checkbox" data-alc="mes" ${alcance === "mes" ? "checked" : ""}><span>Usar este horário em todos os dias de trabalho deste mês</span></label>
          ${alcance ? `<p class="mini" style="margin:0">Vale para ${nTrab(outros)} ${nTrab(outros) === 1 ? "dia" : "dias"}.</p>` : ""}</div>` : ""}
      ` : ""}` : `
      <div class="escolha"><button data-t="T" class="${r.t === "T" ? "sel" : ""}" ${travar ? "disabled" : ""}>Trabalha</button><button data-t="F" class="${r.t === "F" || r.t === "D" ? "sel" : ""}" ${travar ? "disabled" : ""}>Folga</button><button data-t="A" class="${r.t === "A" ? "sel" : ""}" ${travar ? "disabled" : ""}>Afastado</button><button data-t="V" class="${r.t === "V" ? "sel" : ""}" ${travar ? "disabled" : ""}>Férias</button></div>
      ${r.t === "N" ? `<p class="dica">Vaga: a pessoa ainda não entrou neste dia${p.inicio ? ` (começa em ${isoBr(p.inicio)})` : ""}. Para mudar o dia de início, toque no nome da vaga.</p>` : ""}
      ${r.t === "A" || r.t === "V" ? `<p class="dica">${r.t === "A" ? "Afastado (atestado, INSS, licença ou saiu da empresa)" : "Férias"}: não conta como folga. Se o setor ficar descoberto, veja em "O que arrumar".</p>` : ""}
      ${r.t === "T" ? `
        <div class="horarios">
          <label class="campo"><span>Entrada</span>${campoHora("hIni", r.ini, travar)}</label>
          <label class="campo"><span>Saída</span>${campoHora("hFim", r.fim, travar)}</label>
          <label class="campo"><span>Intervalo começa</span>${campoHora("hAlm", r.alm ? r.alm[0] : null, travar)}</label>
          <label class="campo"><span>Intervalo termina</span>${campoHora("hAlmFim", r.alm ? r.alm[1] : null, travar)}</label>
          
        </div>
        <p class="mini" style="margin:-4px 0 0">Digite os horários com números (ex.: 0830 vira 08:30). Sem intervalo: deixe os dois campos do intervalo em branco.</p>
        <div class="resumo-dia">Trabalha <b>${horasTxt(trab)}</b> neste dia${r.alm ? ` · intervalo das ${hm(r.alm[0])} às ${hm(r.alm[1])}` : ""}<br><span class="dica">O normal para ${p.horas}h por semana é ${horasTxt(lim)} por dia.</span>
        ${trab !== lim && !travar ? `<br><button class="btn" id="acertar" style="margin-top:8px">Acertar a saída para fechar ${horasTxt(lim)}</button>` : ""}</div>
        ${!travar ? `<div class="alcance">
          ${sem ? `<label class="marcar"><input type="checkbox" data-alc="semana" ${alcance === "semana" ? "checked" : ""}><span>Usar este horário em todos os dias de trabalho desta semana</span></label>` : ""}
          <label class="marcar"><input type="checkbox" data-alc="mes" ${alcance === "mes" ? "checked" : ""}><span>Usar este horário em todos os dias de trabalho deste mês</span></label>
          ${alcance ? `<p class="mini" style="margin:0">Vale para ${nTrab(outros)} ${nTrab(outros) === 1 ? "dia" : "dias"}. As folgas não mudam; em dia que a loja abre ou fecha em outro horário, o horário se ajusta.</p>` : ""}</div>` : ""}
      ` : !travar && sem && (r.t === "F" || r.t === "D") ? `
        <p style="margin-bottom:4px"><b>Trocar esta folga de dia</b></p><p class="dica">Toque no dia da semana em que a pessoa vai folgar no lugar deste. Ela passa a trabalhar hoje.</p>
        <div class="semana-mini">${sem.dias.map((j) => { const y = E.dias[j], cj = p.dias[j]; return `<button data-j="${j}" class="${cj.t === "T" ? "" : cj.t === "D" ? "d" : "f"} ${j === i ? "atual" : ""}" ${j === i || cj.t !== "T" || y.fechado ? "disabled" : ""}>${DIAS_CURTO[y.w]}<br><b>${String(y.d).padStart(2, "0")}</b><br>${cj.t === "T" ? hm(cj.ini) : cj.t === "D" ? "DOM" : "F"}</button>`; }).join("")}</div>` : ""}
      `}
      ${probs.length ? `<div class="lista-problemas"><p style="margin:10px 0 0"><b>Conferência das regras</b></p>${probs.map(itemProblema).join("")}</div>` : x.fechado ? "" : `<div class="faixa ok" style="margin-top:10px">${ic("check")} Nenhuma regra quebrada para esta pessoa.</div>`}
      ${!travar && r.t !== "X" ? `<div class="linha" style="margin-top:16px"><button class="btn primario grande" id="salvar" style="flex:1">Salvar</button><button class="btn grande" id="cancelar">Cancelar</button></div>${mudouDoPadrao ? `<p style="margin-top:10px"><button class="btn" id="padrao">Voltar ao padrão (${esc(diaTxt(o.dias[i]))})</button></p>` : ""}` : ""}
      <p style="margin-top:18px"><button class="btn" id="verPessoa">Ver o mês desta pessoa</button></p>`);
    $("#fechar", pn).onclick = fecharPainel;
    $("#verPessoa", pn).onclick = () => abrirPessoa(p.id);
    if (travar) return;
    $$("[data-t]", pn).forEach((b) => (b.onclick = () => { const t = b.dataset.t; if (t === "T") { if (r.t !== "T") r = horarioSugerido(p, i); } else if (t === "A" || t === "V" || t === "L") r = { t }; else r = { t: x.w === 0 ? "D" : "F" }; desenhar(); }));
    const g = (id) => $(id, pn);
    ligarHora(g("#hIni"), r.ini, (n) => { const dl = n - r.ini; r.ini = n; r.fim += dl; if (r.alm) r.alm = [r.alm[0] + dl, r.alm[1] + dl]; desenhar(); });
    ligarHora(g("#hFim"), r.fim, (n) => { r.fim = n <= r.ini ? n + 1440 : n; desenhar(); });
    ligarHora(g("#hAlm"), r.alm ? r.alm[0] : null, (n) => { if (n == null) r.alm = null; else { const d = r.alm ? r.alm[1] - r.alm[0] : 60; r.alm = [n, n + d]; } desenhar(); }, true);
    ligarHora(g("#hAlmFim"), r.alm ? r.alm[1] : null, (n) => { if (n == null) r.alm = null; else if (r.alm) r.alm = [r.alm[0], n]; else r.alm = [Math.max(r.ini, n - 60), n]; desenhar(); }, true);
        if (g("#acertar")) g("#acertar").onclick = () => { r.fim = r.ini + limiteDia(p) + (r.alm ? r.alm[1] - r.alm[0] : 0); desenhar(); };
    $$("[data-alc]", pn).forEach((el) => (el.onchange = () => { alcance = el.checked ? el.dataset.alc : ""; desenhar(); }));
    $$("[data-j]", pn).forEach((b) => (b.onclick = () => {
      const j = +b.dataset.j, de = p.dias[j];
      alterar(() => { p.dias[i] = ajustarParaDia(de, i, p); p.dias[j] = { t: E.dias[j].w === 0 ? "D" : "F" }; }, `Folga trocada para ${DIAS_CURTO[E.dias[j].w]} ${dataTxt(E.dias[j])}.`);
      abrirCelula(pid, i);
    }));
    if (g("#padrao")) g("#padrao").onclick = () => { r = clone(o.dias[i]); desenhar(); };
    g("#cancelar").onclick = fecharPainel;
    g("#salvar").onclick = () => {
      const outros = r.t === "T" ? alvos() : [];
      alterar(() => { p.dias[i] = r; outros.forEach((j) => { p.dias[j] = ajustarParaDia(r, j, p); }); }, outros.length ? `Horário aplicado em ${outros.length + 1} dias.` : "Mudança salva.");
      fecharPainel();
    };
  };
  desenhar();
}
/* leva um horário para outro dia, respeitando o horário daquele dia */
function ajustarParaDia(c, j, p) {
  const y = E.dias[j], d = clone(c);
  if (d.t !== "T" || y.we == null) return d;
  // loja abre mais tarde neste dia (ex.: domingo): entra no máximo 15 min antes da abertura, mantendo a jornada
  const cedo = Math.min(y.ws, p.entradaAtual ?? 9999);
  if (d.ini < cedo) { const dl = cedo - d.ini; d.ini += dl; d.fim += dl; if (d.alm) d.alm = [d.alm[0] + dl, d.alm[1] + dl]; }
  if (d.fim > y.we) { const dl = d.fim - y.we, ini0 = Math.min(y.ws, p.entradaAtual ?? 9999); const mover = Math.min(dl, Math.max(0, d.ini - ini0)); d.ini -= mover; d.fim -= mover; if (d.alm) d.alm = [d.alm[0] - mover, d.alm[1] - mover]; if (d.fim > y.we) d.fim = y.we; }
  if (d.alm && d.alm[1] > d.fim - 30) { const dur = d.alm[1] - d.alm[0]; const a = Math.max(d.ini + 60, d.fim - 60 - dur); d.alm = [a, a + dur]; }
  // dia curto (loja fecha cedo): sem almoço longo; até 6h trabalha com pausa de 15 min, até 4h sem pausa
  const vao = d.fim - d.ini;
  if (d.alm && vao <= 375) { if (vao > 240) { const a = Math.round((d.ini + vao / 2 - 7.5) / 15) * 15; d.alm = [a, a + 15]; } else d.alm = null; }
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
    ${p.diarista ? `<div class="faixa aviso">${SELO_DIARISTA}<div>Pessoa de fora paga pelo dia, até 8h por dia. Vem <b>${diasDoDiarista(p)} ${diasDoDiarista(p) === 1 ? "dia" : "dias"}</b> neste mês. Conta na cobertura do setor${p.setor === "Gerência" ? " e na regra de 1 gerente na abertura e 1 no fechamento" : ""}. As regras da 5x2 (folgas, domingos, horas da semana) não valem para diarista. Toque nos dias da escala para marcar quando vem.</div></div>
    <label class="campo"><span>Nome</span><input id="pNomeVaga" maxlength="60" value="${esc(p.nome)}" ${travar ? "disabled" : ""}></label>` : ""}
    ${p.vaga ? `<div class="faixa aviso"><span class="selo-vaga">VAGA</span><div>Ainda vai ser contratada. Quando a pessoa entrar e aparecer na Senior, o aviso "Entrou na Senior" mostra o botão para ela ocupar esta vaga com estes horários e folgas.</div></div>
    <div class="horarios">
      <label class="campo"><span>Nome da vaga</span><input id="pNomeVaga" maxlength="60" value="${esc(p.nome)}" ${travar ? "disabled" : ""}></label>
      <label class="campo"><span>Começa no dia</span><select id="pInicio" ${travar ? "disabled" : ""}>${E.dias.map((x) => `<option value="${x.iso}" ${x.iso === (p.inicio || E.dias[0].iso) ? "selected" : ""}>${DIAS_CURTO[x.w]} ${dataTxt(x)}${x === E.dias[0] ? " (mês todo)" : ""}</option>`).join("")}</select></label>
    </div>` : ""}
    <div class="horarios">
      <label class="campo"><span>Setor</span><select id="pSetor" ${travar ? "disabled" : ""}>${setores.map((s) => `<option ${s === p.setor ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
      ${p.diarista ? "" : `<label class="campo"><span>Horas por semana</span><select id="pHoras" ${travar ? "disabled" : ""}>${[42, 36, 30, 24, 20].map((h) => `<option value="${h}" ${h === p.horas ? "selected" : ""}>${h}h</option>`).join("")}</select></label>`}
    </div>
    ${p.setor !== "Gerência" ? `<label class="marcar"><input type="checkbox" id="pSub" ${p.subGerente ? "checked" : ""} ${travar ? "disabled" : ""}><span><b>Substitui o gerente</b>: pode abrir e fechar a loja quando não tiver gerente (conta para a regra de 1 gerente na abertura e 1 no fechamento).</span></label>` : ""}
    ${restr.length ? `<p class="dica"><b>Combinado:</b> ${restr.map(esc).join(" · ")}</p>` : ""}
    <h3 style="margin-top:14px">Semanas</h3>
    <table class="tab"><tbody>${semanas.map(({ S, min, folgas }) => `<tr><td>${dataTxt(E.dias[S.dias[0]])} a ${dataTxt(E.dias[S.dias[S.dias.length - 1]])}${S.cheia ? "" : ' <span class="mini">(semana incompleta)</span>'}</td><td>${horasTxt(min)}</td><td>${p.diarista ? (() => { const n = S.dias.filter((i) => p.dias[i].t === "T").length; return `${n} ${n === 1 ? "dia" : "dias"}`; })() : `${folgas} folga${folgas === 1 ? "" : "s"}`}</td></tr>`).join("")}</tbody></table>
    ${p.diarista ? "" : `<p class="dica" style="margin-top:8px">Domingos de folga no mês: <b>${domF}</b></p>`}
    <div class="lista-problemas">${probs.length ? probs.map(itemProblema).join("") : `<div class="faixa ok">${ic("check")} Nenhuma regra quebrada.</div>`}</div>
    ${travar ? "" : `<div class="linha" style="margin-top:16px">
      ${o && !p.fora ? `<button class="btn" id="pPadrao">Voltar a pessoa ao padrão</button>` : ""}
      ${p.fora ? `<button class="btn primario" id="pVolta">Trazer de volta para a escala</button>` : p.vaga ? `<button class="btn perigo" id="pApaga">Apagar esta vaga</button>` : p.diarista ? `<button class="btn perigo" id="pApaga">Apagar este diarista</button>` : p.novo ? `<button class="btn perigo" id="pApaga">Tirar esta pessoa (incluída por engano)</button>` : `<button class="btn perigo" id="pFora">Tirar da escala</button>`}
    </div>`}`);
  $("#fechar", pn).onclick = fecharPainel;
  if (travar) return;
  $("#pSetor", pn).onchange = (e) => { alterar(() => { p.setor = e.target.value; }, "Setor mudado."); abrirPessoa(pid); };
  const nv = $("#pNomeVaga", pn); if (nv) nv.onchange = () => { const v = nv.value.trim(); if (v.length < 3) { nv.value = p.nome; return; } alterar(() => { p.nome = v; p.nomeCompleto = v; }, p.diarista ? "Nome mudado." : "Nome da vaga mudado."); abrirPessoa(pid); };
  const pi = $("#pInicio", pn); if (pi) pi.onchange = () => { alterar(() => aplicarInicio(p, pi.value), pi.value > E.dias[0].iso ? `A vaga começa em ${isoBr(pi.value)}. Confira as folgas da primeira semana.` : "A vaga vale o mês todo."); abrirPessoa(pid); };
  const sub = $("#pSub", pn); if (sub) sub.onchange = (e) => { alterar(() => { p.subGerente = e.target.checked; }, e.target.checked ? `${p.nome} agora pode abrir e fechar no lugar do gerente.` : `${p.nome} não substitui mais o gerente.`); abrirPessoa(pid); };
  if ($("#pHoras", pn)) $("#pHoras", pn).onchange = (e) => { alterar(() => { p.horas = +e.target.value; }, `Agora ${e.target.value}h por semana. Confira os horários.`); abrirPessoa(pid); };
  const bp = $("#pPadrao", pn); if (bp) bp.onclick = () => { alterar(() => { Object.assign(p, clone(o)); }, "Pessoa voltou ao padrão."); abrirPessoa(pid); };
  const bv = $("#pVolta", pn); if (bv) bv.onclick = () => { alterar(() => { delete p.fora; }, "Voltou para a escala."); abrirPessoa(pid); };
  const ba = $("#pApaga", pn); if (ba) ba.onclick = () => { alterar(() => { E.pessoas = E.pessoas.filter((q) => q.id !== pid); }, p.vaga ? "Vaga apagada." : p.diarista ? "Diarista apagado." : "Pessoa tirada."); fecharPainel(); };
  const bf = $("#pFora", pn); if (bf) bf.onclick = () => modal(`<h2>Tirar ${esc(p.nome)} da escala</h2><p class="dica">A pessoa some da escala deste mês (dá para trazer de volta depois).</p>
    <label class="campo"><span>Motivo</span><select id="mot"><option>Saiu da empresa</option><option>Afastada (atestado, INSS, licença)</option><option>Férias no mês</option><option>Mudou de loja</option><option>Outro</option></select></label>`,
    [{ rotulo: "Cancelar" }, { rotulo: "Tirar da escala", tipo: "primario", fn: (m) => { const mot = $("#mot", m).value; alterar(() => { p.fora = { motivo: mot }; }, "Pessoa tirada da escala."); fecharPainel(); } }]);
}

/* ================= INCLUIR PESSOA ================= */
function incluirPessoa(pre) {
  if (travada()) return;
  pre = pre && typeof pre === "object" && !(pre instanceof Event) ? pre : {};
  const setores = [...new Set(setoresDe(E).concat(ORDEM_SETOR.slice(0, 9)))];
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const setorPre = setores.find((s) => norm(pre.setor).includes(norm(s)) || norm(s).includes(norm(pre.setor) || "§")) || pre.setorEscala || "";
  const vagaPre = !!pre.vaga && pre.chave == null;
  modal(`<h2>Incluir pessoa</h2>
    ${pre.chave != null ? "" : `<div class="escolha" id="nTipo"><button data-tipo="p" class="${vagaPre ? "" : "sel"}">Pessoa do quadro</button><button data-tipo="v" class="${vagaPre ? "sel" : ""}">Vaga: ainda vai contratar</button><button data-tipo="d">Diarista: cobre dias ou horários</button></div>`}
    <p class="dica" id="nDica"></p>
    <label class="campo"><span id="nNomeRot">Nome</span><input id="nNome" placeholder="Nome e sobrenome" value="${esc(pre.nome || "")}"></label>
    <div class="horarios"><label class="campo"><span>Setor</span><select id="nSetor">${setores.map((s) => `<option ${s === setorPre ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
    <label class="campo" id="nHorasC"><span>Horas por semana</span><select id="nHoras"><option value="42">42h</option><option value="30">30h</option><option value="24">24h</option></select></label></div>
    <div class="horarios" id="nDiasC"><label class="campo"><span>Vem em</span><select id="nDiaW"><option value="">nenhum dia ainda (marco depois)</option>${[0, 1, 2, 3, 4, 5, 6].map((w) => `<option value="${w}" ${w === 0 ? "selected" : ""}>todos os ${w === 0 || w === 6 ? DIAS_SEM[w] + "s" : DIAS_SEM[w] + "s-feiras"}</option>`).join("")}</select></label>
    <label class="campo"><span>Horas no dia</span><select id="nHorasDia">${[[480, "8h"], [360, "6h"], [240, "4h"]].map(([m, t]) => `<option value="${m}">${t}</option>`).join("")}</select></label></div>
    <div class="horarios"><label class="campo"><span>Entrada de costume</span><select id="nIni">${opcoesHora(495, 300, 1320)}</select></label>
    <label class="campo" id="nFixaC"><span>Folga fixa</span><select id="nFixa"><option value="">Igual à de um colega do setor</option>${[1, 2, 3, 4, 5].map((w) => `<option value="${w}">${DIAS_SEM[w]}</option>`).join("")}</select></label></div>
    <label class="campo" id="nInicioC"><span>Começa no dia</span><select id="nInicio">${E.dias.map((x, k) => `<option value="${x.iso}">${DIAS_CURTO[x.w]} ${dataTxt(x)}${k === 0 ? " (mês todo)" : ""}</option>`).join("")}</select></label>`,
  [{ rotulo: "Cancelar" }, { rotulo: "Incluir", tipo: "primario", fn: (m) => {
    const ehVaga = !!$("#nTipo [data-tipo='v'].sel", m), ehDia = !!$("#nTipo [data-tipo='d'].sel", m);
    const setor = $("#nSetor", m).value, horas = +$("#nHoras", m).value, ini = +$("#nIni", m).value, fixa = $("#nFixa", m).value;
    if (ehDia) {
      // diarista: começa sem dias; se escolheu um dia da semana, já vem em todos esses dias do mês
      const nome = $("#nNome", m).value.trim() || proximoNomeDiarista(setor);
      const w = $("#nDiaW", m).value, dur = +$("#nHorasDia", m).value, alm = dur > 360 ? 60 : dur > 240 ? 15 : 0;
      const nd = { id: "d" + Date.now().toString(36), nome, nomeCompleto: nome, cargo: "Diarista", setor, horas: 42, novo: true, diarista: true, entradaAtual: null, turno: null, saidaMax: null, entradaMin: null, semDomingo: false, semFeriado: false, dias: [] };
      nd.dias = E.dias.map((x) => {
        if (w === "" || x.w !== +w || x.fechado) return { t: "L" };
        let d = montarDia(ini, ini + dur + alm, null, alm);
        d = ajustarParaDia(d, E.dias.indexOf(x), nd);
        return d;
      });
      const n = nd.dias.filter((c) => c.t === "T").length;
      alterar(() => { E.pessoas.push(nd); }, n ? `${nome} incluído: vem ${n} ${n === 1 ? "dia" : "dias"} no mês.` : `${nome} incluído. Toque nos dias da escala para marcar quando vem.`);
      setTimeout(() => abrirPessoa(nd.id), 50);
      return;
    }
    const nome = $("#nNome", m).value.trim() || (ehVaga ? proximoNomeVaga(setor) : "");
    if (nome.length < 3) { toast("Escreva o nome."); return false; }
    const base = colegaModelo(setor, horas);
    const np = { id: "n" + Date.now().toString(36), ...(pre.chave != null ? { chave: +pre.chave } : {}), nome, nomeCompleto: nome, cargo: "", setor, horas, novo: true, ...(ehVaga ? { vaga: true } : {}), entradaAtual: null, turno: null, saidaMax: null, entradaMin: null, semDomingo: horas === 30, semFeriado: false, dias: [] };
    np.dias = E.dias.map((x, i) => {
      let c = base ? base.dias[i] : { t: x.w === 0 || x.w === 6 ? "F" : "T" };
      if (c.t === "A" || c.t === "V" || c.t === "N") c = { t: "T" }; // afastamento do colega não passa para a pessoa nova
      if (horas === 30 && x.w === 0 && !x.fechado) c = { t: "D" };
      if (c.t !== "T") return clone(c);
      const lim = limiteDia(np), alm = lim > 360 ? 120 : lim > 240 ? 15 : 0;
      let d = montarDia(ini, ini + lim + alm, null, alm);
      d = ajustarParaDia(d, i, np);
      if (x.ws != null && d.ini < x.ws) { const dl = x.ws - d.ini; d.ini += dl; d.fim = Math.min(d.fim + dl, x.we); if (d.alm) d.alm = [d.alm[0] + dl, d.alm[1] + dl]; }
      return d;
    });
    if (fixa) moverFolgaFixa(np, +fixa);
    if (ehVaga) aplicarInicio(np, $("#nInicio", m).value);
    alterar(() => { E.pessoas.push(np); }, ehVaga ? `${nome} incluída. Ela aparece na escala com o selo VAGA.` : `${nome} incluída.`);
    setTimeout(() => abrirPessoa(np.id), 50);
  } }]);
  setTimeout(() => {
    const f = $$(".modal-fundo").pop(); if (!f) return;
    const ajustar = () => {
      const v = !!$("#nTipo [data-tipo='v'].sel", f), d = !!$("#nTipo [data-tipo='d'].sel", f);
      $("#nHorasC", f).style.display = d ? "none" : "";
      $("#nFixaC", f).style.display = d ? "none" : "";
      $("#nDiasC", f).style.display = d ? "" : "none";
      if (d) {
        $("#nDica", f).textContent = "Pessoa de fora paga pelo dia (até 8h) para cobrir dias ou horários: por exemplo, o domingo em que o gerente folga. Conta na cobertura do setor e, na Gerência, na regra de gerente na abertura e no fechamento. As regras da 5x2 não valem para diarista.";
        $("#nNomeRot", f).textContent = "Nome do diarista (se já souber)";
        $("#nNome", f).placeholder = proximoNomeDiarista($("#nSetor", f).value);
        $("#nInicioC", f).style.display = "none";
        return;
      }
      $("#nDica", f).textContent = v ?"Para quem ainda vai ser contratado. A vaga entra na escala com horário e folgas e conta na cobertura. Quando a pessoa entrar na Senior, ela ocupa a vaga." : "Para quem entrou agora ou veio de outra loja. A escala dela começa igual à de um colega do mesmo setor; depois é só ajustar.";
      $("#nNomeRot", f).textContent = v ? "Nome da vaga" : "Nome";
      $("#nNome", f).placeholder = v ? proximoNomeVaga($("#nSetor", f).value) : "Nome e sobrenome";
      $("#nInicioC", f).style.display = v ? "" : "none";
    };
    $$("#nTipo [data-tipo]", f).forEach((b) => (b.onclick = () => { $$("#nTipo [data-tipo]", f).forEach((o) => o.classList.toggle("sel", o === b)); ajustar(); }));
    $("#nSetor", f).onchange = ajustar;
    ajustar();
    const n = $("#nNome", f); if (n) n.focus();
  }, 50);
}
/* põe a folga da semana no dia escolhido (segunda a sexta), trocando com a folga que estava em outro dia útil */
function moverFolgaFixa(p, w) {
  (E.semanas || []).forEach((S) => {
    const j = S.dias.find((i) => E.dias[i].w === w);
    if (j == null || p.dias[j].t !== "T" || E.dias[j].fechado) return;
    const cands = S.dias.filter((i) => i !== j && p.dias[i].t === "F" && E.dias[i].w >= 1 && E.dias[i].w <= 5 && !E.dias[i].fechado);
    if (!cands.length) return;
    // troca com a folga que deixa a maior sequência de dias trabalhados mais curta (5x2: no máximo 5 seguidos)
    const maiorSeq = (ds) => { let m = 0, s = 0; ds.forEach((c) => { s = c.t === "T" ? s + 1 : 0; m = Math.max(m, s); }); return m; };
    const testa = (k) => { const ds = p.dias.slice(); ds[k] = ajustarParaDia(p.dias[j], k, p); ds[j] = { t: "F" }; return ds; };
    const atual = maiorSeq(p.dias);
    const op = cands.map((k) => ({ k, ds: testa(k) })).map((o) => ({ ...o, seq: maiorSeq(o.ds), dist: Math.abs(o.k - j) })).sort((a, b) => a.seq - b.seq || a.dist - b.dist)[0];
    if (op.seq > Math.max(5, atual)) return; // não piora a regra dos 5 dias seguidos
    p.dias = op.ds;
  });
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
    const folga = ps.filter((p) => p.dias[i].t !== "T" && !p.diarista);
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
      ${trab.map((p) => { const cc = p.dias[i]; return `<div class="lt-linha"><div class="lt-nome" data-p="${esc(p.id)}">${p.diarista ? SELO_DIARISTA : ""}${esc(p.nome)}</div><div class="lt-pista"><div class="lt-barra${p.diarista ? " diarista" : ""}" data-p="${esc(p.id)}" style="left:${pct(cc.ini)}%;width:${pct(cc.fim) - pct(cc.ini)}%">${hm(cc.ini)} às ${hm(cc.fim)}</div>${cc.alm ? `<div class="lt-almoco" style="left:${pct(cc.alm[0])}%;width:${pct(cc.alm[1]) - pct(cc.alm[0])}%"></div>` : ""}</div></div>`; }).join("")}
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

/* ================= EQUIPE (funcionários por setor) ================= */
let EQ = { busca: "", fora: false, abertos: new Set() };
/* resumo da semana de uma pessoa, tirado da escala aberta */
/* ================= ESCALA 6x1 ATUAL (referência, só leitura) ================= */
const tem6x1 = () => !!(P && P.escala6x1 && Array.isArray(P.escala6x1.pessoas) && P.escala6x1.pessoas.length);
const SEIS = { abertos: new Set() };
function telaSeisUm(c) {
  if (!tem6x1()) { location.hash = "#/escala"; return; }
  const S = P.escala6x1, num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
  const hr = (v) => (num(v) == null ? "-" : hm(v));
  const lista = S.pessoas.map((q) => {
    const ini = num(q.ini), fim = num(q.fim), alm = Array.isArray(q.alm) ? q.alm.map(num) : [null, null];
    const dia = ini != null && fim != null ? fim - ini - (alm[0] != null && alm[1] != null ? alm[1] - alm[0] : 0) : null;
    const p = q.id ? E.pessoas.find((x) => x.id === String(q.id)) : null;
    return { q, ini, fim, alm, dia, p, r: p && !p.fora ? resumoPessoa(p) : null };
  });
  const setores = [...new Set(lista.map((x) => String(x.q.setor || "")))];
  const n44 = lista.filter((x) => !x.q.vaga && +x.q.horas === 44).length, n36 = lista.filter((x) => !x.q.vaga && +x.q.horas === 36).length, nv = lista.filter((x) => x.q.vaga).length;
  const cartoes = setores.map((s) => {
    const ps = lista.filter((x) => String(x.q.setor || "") === s);
    return `<details class="cartao eq-setor" data-setor="${esc(s)}" ${SEIS.abertos.has(s) ? "open" : ""}><summary><span class="eq-titulo"><b>${esc(s)}</b> <span class="mini">${ps.length} ${ps.length === 1 ? "pessoa" : "pessoas"}</span></span></summary>
      <div class="tabela-rolagem"><table class="tab seis"><thead><tr><th>Pessoa</th><th>Folga (6x1)</th><th>Horário hoje (6x1)</th><th>Por dia</th><th class="cinco">Na 5x2 sugerida</th></tr></thead><tbody>
      ${ps.map(({ q, ini, fim, alm, dia, p, r }) => `<tr class="${p ? "clica" : ""}" ${p ? `data-p="${esc(p.id)}"` : ""}>
        <td><b>${q.vaga ? '<span class="selo-vaga">VAGA</span>' : ""}${esc(String(q.nome || ""))}</b><br><span class="mini">${+q.horas === 36 ? "36h" : "44h"}${q.enc ? " · encarregado(a)" : ""}</span></td>
        <td>${esc(String(q.folga || "-"))}</td>
        <td>${hr(ini)} às ${hr(fim)}${alm[0] != null ? `<br><span class="mini">intervalo ${hr(alm[0])} às ${hr(alm[1])}</span>` : ""}</td>
        <td>${dia != null ? horasTxt(dia) : "-"}</td>
        <td class="cinco">${p && p.fora ? `<span class="mini">fora da escala</span>` : r ? `${p.horas}h · folga fixa ${esc(r.folgaFixa.toLowerCase())}<br><span class="mini">${esc(r.horario)} · domingo: ${esc(r.domingo)}</span>` : `<span class="mini">-</span>`}</td></tr>`).join("")}
      </tbody></table></div></details>`;
  }).join("");
  c.innerHTML = `<section class="cartao"><h1>Escala 6x1 atual</h1>
    <p class="dica">Como a loja trabalha hoje (6x1, 44h e 36h), da planilha ${esc(String(S.fonte || "do escritório"))}${S.em ? ", de " + esc(dataBr(String(S.em))) : ""}. Serve de comparação: a coluna da direita mostra a mesma pessoa na escala 5x2 sugerida (42h e 30h). Toque na pessoa para abrir a ficha dela.</p>
    <div class="numeros"><div class="numero"><b>${n44}</b><span>de 44h (passam a 42h)</span></div><div class="numero"><b>${n36}</b><span>de 36h (passam a 30h, folga todo domingo)</span></div>${nv ? `<div class="numero"><b>${nv}</b><span>${nv === 1 ? "vaga" : "vagas"} a contratar</span></div>` : ""}</div>
    ${Array.isArray(S.setoresFora) && S.setoresFora.length ? `<p class="dica" style="margin-bottom:0">Fora da escala: ${S.setoresFora.map((x) => esc(String(x))).join(", ")}.</p>` : ""}
  </section>
  <div class="seis-grade">${cartoes}</div>`;
  $$("details.eq-setor", c).forEach((d) => (d.ontoggle = () => { d.open ? SEIS.abertos.add(d.dataset.setor) : SEIS.abertos.delete(d.dataset.setor); }));
  $$("tr[data-p]", c).forEach((el) => (el.onclick = () => abrirPessoa(el.dataset.p)));
}
function resumoPessoa(p) {
  const uteis = {}, horarios = {};
  let domTrab = 0, domAberto = 0;
  E.dias.forEach((x, i) => {
    const c = p.dias[i];
    if (x.fechado) return;
    if (x.w >= 1 && x.w <= 5 && c.t !== "T") uteis[x.w] = (uteis[x.w] || 0) + 1;
    if (x.w === 0 && x.fixo) { domAberto++; if (c.t === "T") domTrab++; }
    if (c.t === "T") { const k = hm(c.ini) + " às " + hm(c.fim); horarios[k] = (horarios[k] || 0) + 1; }
  });
  const fixa = Object.entries(uteis).sort((a, b) => b[1] - a[1])[0];
  const horario = Object.entries(horarios).sort((a, b) => b[1] - a[1])[0];
  const lojaDom = E.loja.domingo;
  const domingo = lojaDom === "fechado" ? "loja fechada" : lojaDom === "diaristas" ? "folga (domingo com diaristas)" : domAberto === 0 ? "-" : domTrab === 0 ? "folga todo domingo" : `trabalha ${domTrab} de ${domAberto} domingos`;
  const turno = horario ? (minDe(horario[0].slice(0, 5)) < 660 ? "manhã" : "tarde") : "";
  return { folgaFixa: fixa ? DIAS_SEM[+fixa[0]] : "-", horario: horario ? horario[0] : "sem dias de trabalho", turno, domingo };
}
function telaEquipe(c) {
  const busca = EQ.busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const casa = (p) => !busca || (p.nome + " " + (p.cargo || "") + " " + p.setor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(busca);
  const ativos_ = E.pessoas.filter((p) => !p.fora);
  const setores = setoresDe(E);
  const obrig = Object.fromEntries(SETORES_OBRIGATORIOS);
  const nDia = ativos_.filter((p) => p.diarista).length;
  const total = ativos_.length - nDia, h30 = ativos_.filter((p) => p.horas === 30 && !p.diarista).length;
  const porSetorNum = setores.map((s) => ({ s, n: ativos_.filter((p) => p.setor === s && !p.diarista).length }));
  const maxN = Math.max(1, ...porSetorNum.map((x) => x.n));
  const incompleto = Object.fromEntries(setoresIncompletos().map((x) => [x.setor, x]));
  const subs = ativos_.filter((p) => p.subGerente);
  const cartoes = setores.map((s) => {
    const ps = ativos_.filter((p) => p.setor === s && casa(p)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (!ps.length) return "";
    const n = ativos_.filter((p) => p.setor === s && !p.diarista).length, pouco = (obrig[s] || s === "Gerência") && n < 3, inc = incompleto[s];
    const aberto = busca || EQ.abertos.has(s);
    return `<details class="cartao eq-setor" data-setor="${esc(s)}" ${aberto ? "open" : ""}><summary><span class="eq-titulo"><b>${esc(s)}</b> <span class="mini">${n} ${n === 1 ? "pessoa" : "pessoas"}</span></span>
      <span class="eq-selos">${inc ? `<span class="selo-regra falta">faltam ${inc.era - inc.agora}</span>` : ""}${obrig[s] ? `<span class="selo-regra ${pouco ? "falta" : "emp"}">${pouco ? "obrigatório: pouca gente" : "obrigatório"}</span>` : ""}</span></summary>
      ${inc ? `<p class="dica" style="color:var(--erro)">Setor incompleto: eram ${inc.era} pessoas na escala padrão, agora ${inc.agora}. Alguém saiu ou está afastado o mês todo e ninguém entrou no lugar.</p>` : ""}
      ${pouco ? (s === "Gerência" ? `<p class="dica" style="color:var(--erro)">Só ${n} ${n === 1 ? "gerente" : "gerentes"}: com 5x2 não dá para ter gerente abrindo e fechando todo dia (precisa de 3). Toque em alguém de confiança (fiscal, encarregado) e marque <b>"Substitui o gerente"</b>${subs.length ? `. Substitutos hoje: ${subs.map((q) => esc(q.nome)).join(", ")}` : ""}.</p>` : `<p class="dica" style="color:var(--erro)">Setor obrigatório com ${n} ${n === 1 ? "pessoa" : "pessoas"}: com folgas e almoço não dá para cobrir todos os horários. O ideal é pelo menos 3.</p>`) : ""}
      <div class="eq-lista">${ps.map((p) => { const r = resumoPessoa(p); const comb = [p.subGerente && "substitui o gerente", p.entradaMin && `entra a partir das ${p.entradaMin}`, p.saidaMax && `sai até as ${p.saidaMax}`, p.semDomingo && p.horas !== 30 && "não trabalha domingo", p.semFeriado && "não trabalha feriado"].filter(Boolean);
        return `<button class="eq-pessoa" data-p="${esc(p.id)}"><span class="eq-avatar ${r.turno === "manhã" ? "m" : "t"}">${esc(p.nome.split(" ").map((x) => x[0]).slice(0, 2).join(""))}</span>
          <span class="eq-info"><b>${seloDe(p)}${esc(p.nome)}</b><small>${p.vaga ? (p.inicio ? "a contratar · começa " + isoBr(p.inicio) : "a contratar") : p.diarista ? "paga pelo dia, até 8h" : esc(tituloBonito(p.cargo || "")) + (p.novo ? " · incluída" : "")}</small>
          <span class="eq-tags">${p.diarista ? `<i>${diasDoDiarista(p)} ${diasDoDiarista(p) === 1 ? "dia" : "dias"} no mês</i><i>${esc(r.horario)}</i>` : `<i>${p.horas}h</i><i>${esc(r.horario)}</i><i>folga fixa: ${esc(r.folgaFixa)}</i><i>domingo: ${esc(r.domingo)}</i>`}${comb.map((t) => `<i class="comb">${esc(t)}</i>`).join("")}</span></span></button>`; }).join("")}</div></details>`;
  }).join("");
  const fora = E.pessoas.filter((p) => p.fora);
  c.innerHTML = `${faixaAlertas()}
  <section class="cartao"><h1>Equipe</h1>
    <p class="dica">Quem está na escala de ${esc(mesTxt(ESC.mes))}, separado por setor. Toque no setor para ver as pessoas; toque na pessoa para ver o mês dela, mudar o setor ou as horas.</p>
    <div class="numeros"><div class="numero"><b>${total - vagas().length}</b><span>pessoas na escala${vagas().length ? ` + ${vagas().length} ${vagas().length === 1 ? "vaga" : "vagas"} a contratar` : ""}${nDia ? ` + ${nDia} ${nDia === 1 ? "diarista" : "diaristas"}` : ""}</span></div><div class="numero"><b>${setores.length}</b><span>setores</span></div><div class="numero"><b>${total - h30}</b><span>de 42h</span></div><div class="numero"><b>${h30}</b><span>de 30h (folgam todo domingo)</span></div></div>
    <details class="abre"><summary>Pessoas por setor</summary><div><div class="hbarras">${porSetorNum.map((x) => `<div class="hbarra"><span class="hb-nome">${esc(x.s)}</span><div class="hb-pista"><div class="barra ${obrig[x.s] && x.n < 3 ? "cob-barra vermelho" : ""}" style="width:${(x.n / maxN) * 100}%"></div></div><span class="hb-val">${x.n}</span></div>`).join("")}</div></div></details>
    <div class="ferramentas" style="margin:10px 0 0"><input class="busca" id="eqBusca" placeholder="Procurar por nome, cargo ou setor" value="${esc(EQ.busca)}" aria-label="Procurar">${travada() ? "" : `<span style="flex:1"></span><button class="btn" id="eqIncluir">${ic("mais")} Incluir pessoa</button>`}</div>
  </section>
  <div class="eq-grade">${cartoes || `<section class="cartao"><p class="dica">Ninguém com essa busca.</p></section>`}</div>
  ${fora.length ? `<details class="abre"><summary>Tiradas da escala neste mês (${fora.length})</summary><div><table class="tab"><tbody>${fora.map((p) => `<tr class="clica" data-p="${esc(p.id)}"><td><b>${esc(p.nome)}</b><br><span class="mini">${esc(p.setor)}</span></td><td class="mini">${esc(p.fora.motivo || "")}</td></tr>`).join("")}</tbody></table></div></details>` : ""}
  ${(E.fora || []).length ? `<details class="abre"><summary>Quem não entra na escala (${E.fora.length})</summary><div><p class="dica">Afastados, aprendizes, limpeza, depósito, administrativo e outros.</p><table class="tab"><tbody>${E.fora.map((f) => `<tr><td>${esc(tituloBonito(f.nome))}</td><td class="mini">${esc(tituloBonito(f.cargo || ""))}</td><td class="mini">${esc(f.motivo || "")}</td></tr>`).join("")}</tbody></table></div></details>` : ""}`;
  const b = $("#eqBusca", c); b.oninput = () => { EQ.busca = b.value; const pos = b.selectionStart; telaEquipe(c); const n = $("#eqBusca", c); n.focus(); n.setSelectionRange(pos, pos); };
  const bi = $("#eqIncluir", c); if (bi) bi.onclick = () => incluirPessoa();
  ligarFaixaAlertas(c);
  $$("details.eq-setor", c).forEach((d) => (d.ontoggle = () => { if (busca) return; d.open ? EQ.abertos.add(d.dataset.setor) : EQ.abertos.delete(d.dataset.setor); }));
  $$("[data-p]", c).forEach((el) => (el.onclick = () => abrirPessoa(el.dataset.p)));
}
const tituloBonito = (s) => String(s || "").toLowerCase().replace(/(^|\s|\()(\S)/g, (m, a, b) => a + b.toUpperCase());

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
  <section class="cartao"><h2>Setores que não podem ficar vazios</h2>
    <p class="dica">Regra da empresa: com a loja aberta, sempre tem que ter <b>operadora de caixa, açougue, padaria e fiscal de caixa</b> (já contando os intervalos).</p>
    ${cob.length ? `<div class="faixa erro"><b>${cob.length}</b>&nbsp;${cob.length === 1 ? "horário ficou" : "horários ficaram"} sem alguém desses setores.</div><p class="dica">Arrume mudando o intervalo de alguém, a entrada ou a saída, ou a folga. Quando o setor não tem gente suficiente (1 ou 2 pessoas), chame diarista ou fale com o escritório.</p><details class="abre"><summary>Ver dia por dia</summary><div>${grupo(cob)}</div></details>` : `<div class="faixa ok">${ic("check")} Todos os horários têm operadora, açougue, padaria e fiscal.</div>`}
  </section>`;
  $$("[data-p]", c).forEach((b) => (b.onclick = () => (b.dataset.i === "" ? abrirPessoa(b.dataset.p) : abrirCelula(b.dataset.p, +b.dataset.i))));
  $$("[data-dia]", c).forEach((b) => (b.onclick = () => { DIA_SEL = +b.dataset.dia; location.hash = "#/dia"; }));
}

/* ================= HISTÓRICO E VOLTAR PARA A PADRÃO (fechado no Início) ================= */
function ligarHistorico(c) {
  const tp = $("#tudoPadrao", c); if (tp) tp.onclick = () => modal(`<h2>Voltar tudo para a escala padrão?</h2><p>Tudo o que foi mexido some e a escala fica igual à que veio pronta.</p>`, [{ rotulo: "Cancelar" }, { rotulo: "Voltar tudo", tipo: "primario", fn: () => { alterar(() => { E = clone(P); }, "Escala voltou ao padrão."); } }]);
  const det = $("#detHist", c); if (!det) return;
  let carregou = false;
  det.addEventListener("toggle", async () => {
    if (!det.open || carregou) return; carregou = true;
    const { data } = await SB.from("escalas_historico").select("quando,quem,acao").eq("escala_id", ESC.id).order("quando", { ascending: false }).limit(30);
    const h = $("#hist", det); if (!h) return;
    const linhas = (data || []).map((r) => `<tr><td>${esc(quando(r.quando))}</td><td>${esc(r.quem || "")}</td><td>${r.acao === "reabriu" ? "reabriu a escala" : String(r.acao).startsWith("lancou") ? "lançou " + esc(String(r.acao).replace(/^lancou:?\s*/, "") || "a escala") : esc(r.acao)}</td></tr>`);
    VERSOES.forEach((v) => linhas.push(`<tr><td>${esc(quando(v.atualizado_em))}</td><td>${esc(v.atualizado_por || "")}</td><td>mexeu em "${esc(v.nome)}"</td></tr>`));
    h.innerHTML = linhas.length ? `<table class="tab"><tbody>${linhas.join("")}</tbody></table>` : `<p class="dica">Ainda não foi lançada.</p>`;
  });
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
      <li><div><b>Vaga</b> (em "Incluir pessoa"): para quem ainda vai ser contratado. Entra na escala com horário, folga fixa e dia de início, aparece com o selo VAGA e conta na cobertura. Quando a pessoa entrar na Senior, o aviso dela tem o botão "Ocupar a vaga".</div></li>
      <li><div><b>Diarista</b> (em "Incluir pessoa"): pessoa de fora paga pelo dia, até 8h, para cobrir dias ou horários. Ex.: o gerente folga todo domingo; inclua um diarista na Gerência que vem todos os domingos e o erro de gerente na abertura/fechamento some. As regras da 5x2 não valem para diarista.</div></li>
      <li><div><b>Mesmo horário no mês todo:</b> ao mudar o horário de um dia, marque "Usar este horário em todos os dias de trabalho deste mês". As folgas não mudam.</div></li>
      <li><div><b>"Dia a dia"</b> mostra quem está na loja em cada hora, setor por setor, e se o número de pessoas dá conta do movimento.</div></li>
      <li><div><b>"O que arrumar"</b> lista o que quebra alguma regra. Tudo vermelho precisa ser arrumado antes de lançar. O amarelo é só aviso.</div></li>
      <li><div><b>"Lançar escala"</b> no Início. A escala fica travada e o escritório vê que a sua loja lançou. Para mudar depois, toque em "Reabrir".</div></li>
    </ol></section>
  <p class="dica" style="margin:0 4px 14px">As regras da escala estão na aba <a href="#/regras">Regras</a>.</p>
  <details class="abre"><summary>Tudo fica salvo?</summary><div><p>A escala padrão é fixa e nunca muda. Quando você mexe nela, o site cria na hora uma escala sua (ex.: "Escala 2") e cada mudança se salva sozinha, mesmo com coisas para arrumar. A bolinha vermelha ao lado do nome mostra quantas faltam arrumar (aparece "Salvo às ..." no topo). Dá para fechar e abrir em outro computador.</p><p>No topo você escolhe qual escala abrir. No Início, em "Histórico e voltar para a padrão", você vê quem lançou e quem mexeu, e pode voltar tudo para a escala padrão.</p><p>Esqueceu a senha? Fale com o escritório.</p></div></details>`;
}

/* ================= REGRAS (para os gerentes lerem) ================= */
function telaRegras(c) {
  const H = E.loja.horario, dom = E.loja.domingo;
  const horaTxt = (h) => (h ? `${h[0]} às ${h[1]}` : "fechada");
  const combinados = E.pessoas.filter((p) => !p.fora).map((p) => ({ p, itens: [p.horas !== 42 && `${p.horas}h por semana`, p.entradaMin && `entra a partir das ${p.entradaMin}`, p.saidaMax && `sai até as ${p.saidaMax}`, p.semDomingo && "não trabalha domingo", p.semFeriado && "não trabalha feriado", p.turno && `turno da ${p.turno === "M" ? "manhã" : "tarde"}`].filter(Boolean) })).filter((x) => x.itens.length);
  const bloco = (titulo, tag, itens) => `<section class="cartao regra"><div class="regra-topo"><h2>${titulo}</h2>${tag}</div><ul>${itens.map((t) => `<li>${t}</li>`).join("")}</ul></section>`;
  const t = { lei: `<span class="selo-regra lei">Lei</span>`, acordo: `<span class="selo-regra acordo">Acordo coletivo</span>`, emp: `<span class="selo-regra emp">Regra da empresa</span>` };
  c.innerHTML = `
  <section class="cartao"><h1>Regras da escala</h1>
    <p class="dica">O que toda escala da loja precisa seguir. O site confere tudo isto sozinho: <b style="color:var(--erro)">vermelho</b> precisa arrumar antes de lançar, <b style="color:var(--aviso)">amarelo</b> é aviso.</p>
  </section>
  <div class="grade2">
  ${bloco("Setores que nunca ficam vazios", t.emp, [
    "Com a loja aberta, <b>sempre</b> tem que ter: <b>operadora de caixa, açougue, padaria e fiscal de caixa</b>.",
    "Vale também na hora do almoço: os intervalos do mesmo setor não podem cair na mesma hora.",
    "O gerente não substitui o fiscal de caixa.",
    "<b>Gerência (obrigatório, trava o lançamento):</b> todo dia, pelo menos <b>1 gerente na abertura e 1 no fechamento</b>. Com 5x2 isso pede 3 gerentes; se a loja tem menos, marque um <b>substituto do gerente</b> na aba Equipe (ex.: fiscal ou encarregado) e coloque essa pessoa para abrir ou fechar.",
    "Se o setor não tem gente para cobrir, chame diarista ou fale com o escritório.",
  ])}
  ${bloco("Folgas", t.emp, [
    "Escala <b>5x2</b>: 2 folgas por semana.",
    "<b>1 folga fixa</b> num dia da semana (segunda a sexta), sempre no mesmo dia.",
    "<b>A outra folga é no domingo.</b> Na semana em que a pessoa trabalha no domingo, essa folga vai para um dia da semana.",
    "<b>Ninguém folga no sábado.</b>",
    "No máximo 5 dias seguidos de trabalho.",
  ])}
  ${bloco("Domingo", t.emp, [
    "Quem é <b>30h</b> (era 36h) <b>folga todo domingo</b>.",
    "Os demais: pelo menos <b>2 domingos de folga</b> no mês.",
    "Nunca 2 domingos seguidos trabalhados.",
    "A equipe de cada setor é dividida em duas turmas que se revezam nos domingos.",
    dom === "fechado" ? "Nesta loja o domingo é <b>fechado</b>." : dom === "diaristas" ? "Nesta loja o domingo é feito <b>só por diaristas</b>: a equipe folga." : `Nesta loja o domingo abre das ${horaTxt(H[0])}.`,
  ])}
  ${bloco("Jornada", t.lei, [
    "Quem é <b>42h</b> por semana trabalha <b>8h24 por dia</b>, 5 dias.",
    "Quem era 36h passa a <b>30h</b> (6h por dia). Horista de 24h continua com 24h.",
    "Passou do limite do dia, vira hora extra. Nunca mais de 10h no dia (CLT art. 59).",
    "As horas da semana não podem passar do contrato.",
  ])}
  ${bloco("Descanso e intervalo", t.lei + t.acordo, [
    "<b>11h de descanso</b> entre a saída de um dia e a entrada do outro (CLT art. 66).",
    "Trabalhou mais de 6h: almoço de <b>45 min a 2h</b> (acordo coletivo, cl. 22). <b>Na nossa escala o almoço é de 2h</b>; só fica menor (até 1h) para quem tem horário de saída combinado.",
    "Trabalhou de 4h a 6h: pausa de <b>15 min</b> (CLT art. 71).",
  ])}
  ${bloco("Horário de entrada e saída", t.emp, [
    "A equipe entra no máximo <b>15 min antes de abrir</b> e sai no máximo <b>15 min depois de fechar</b>. Gerência, açougue e produção podem passar disso quando o gerente mudar à mão (fica só aviso).",
    `Horário desta loja: segunda a sexta ${horaTxt(H[1])}; sábado ${horaTxt(H[6])}; domingo ${dom === "fechado" ? "fechada" : horaTxt(H[0])}.`,
  ])}
  ${bloco("Feriados", t.acordo, [
    "1º de janeiro, Natal e Páscoa: loja fechada, ninguém trabalha.",
    "Feriado com a loja aberta: quem trabalha ganha folga em até 90 dias ou recebe em dobro (acordo coletivo, cl. 20).",
    ...(E.feriados || []).map((f) => `${f.data.slice(8)}/${f.data.slice(5, 7)}: ${esc(f.nome)} (${f.fechado ? "loja fechada" : "loja abre"}).`),
  ])}
  ${bloco("Quando alguém sai, afasta ou entra", t.emp, [
    "A Senior é conferida 4 vezes por dia. Se alguém <b>saiu, foi afastado, entrou de férias ou foi contratado</b>, aparece um aviso no Início e na escala.",
    "<b>A escala nunca muda sozinha.</b> Você escolhe o que fazer em cada aviso: tirar da escala, marcar os dias de afastamento ou férias, incluir quem entrou, ou deixar como está.",
    "Se o setor ficar com menos gente que o quadro, aparece <b>\"setor incompleto, faltando gente\"</b> até alguém entrar no lugar.",
    "Falta de 1 ou 2 dias não muda a escala: fica no ponto.",
    "No dia da pessoa dá para marcar <b>Afastado</b> ou <b>Férias</b>: esses dias não contam como folga.",
  ])}
  ${bloco("Lançar a escala", t.emp, [
    "Só dá para lançar quando não tiver nada <b>vermelho</b> em \"O que arrumar\".",
    "Depois de lançada, a escala fica travada. Para mudar, toque em \"Reabrir\".",
    "A escala padrão nunca muda. O que você mexer vira uma escala com nome.",
  ])}
  </div>
  ${combinados.length ? `<details class="abre"><summary>Combinados de cada pessoa nesta loja (${combinados.length})</summary><div><p class="dica">Estes combinados também são conferidos pelo site.</p><table class="tab"><tbody>${combinados.map(({ p, itens }) => `<tr><td><b>${esc(p.nome)}</b><br><span class="mini">${esc(p.setor)}</span></td><td>${itens.map(esc).join(" · ")}</td></tr>`).join("")}</tbody></table></div></details>` : ""}
  <p class="dica" style="margin:6px 4px 20px">Isto apoia a decisão e não substitui o jurídico, o contador trabalhista ou o sindicato. Dúvida sobre uma regra? Fale com o escritório.</p>`;
}

/* ================= IMPRIMIR E EXCEL ================= */
const nomeExp = (p) => p.vaga ? `${p.nome} (VAGA a contratar)` : p.diarista ? `${p.nome} (DIARISTA)` : p.nome;
const celTxt = (x, c) => (c.t === "T" ? `${hm(c.ini)}-${hm(c.fim)}` : c.t === "X" ? "FERIADO" : c.t === "A" ? "AFASTADO" : c.t === "V" ? "FÉRIAS" : c.t === "N" || c.t === "L" ? "-" : x.fechado ? "" : c.t === "D" ? "DOM" : "FOLGA");
function imprimir() {
  const setores = setoresDe(E);
  const cab = `<tr><th>Nome</th>${E.dias.map((x) => `<th>${LETRA[x.w]}<br>${x.d}</th>`).join("")}</tr>`;
  $("#impressao").innerHTML = `<h1>${esc(ESC.loja_nome)} · escala de ${esc(mesTxt(ESC.mes))}${ESC.status === "lancada" ? ` · lançada em ${esc(quando(ESC.lancada_em))}` : " · NÃO LANÇADA (rascunho)"}</h1>
    <table>${cab}${setores.map((s) => `<tr><td colspan="${E.dias.length + 1}" class="n"><b>${esc(s)}</b></td></tr>` + E.pessoas.filter((p) => !p.fora && p.setor === s).map((p) => `<tr><td class="n">${esc(nomeExp(p))}${p.horas !== 42 ? ` (${p.horas}h)` : ""}</td>${E.dias.map((x, i) => { const c = p.dias[i]; return `<td class="${c.t === "T" ? "" : c.t === "D" ? "d" : "f"}">${c.t === "T" ? `${hm(c.ini)}<br>${hm(c.fim)}` : c.t === "X" ? "FER" : c.t === "A" ? "AFAST" : c.t === "V" ? "FÉRIAS" : c.t === "N" ? "-" : x.fechado ? "" : c.t === "D" ? "DOM" : "F"}</td>`; }).join("")}</tr>`).join("")).join("")}</table>
    <p style="margin-top:4px">Em cada dia: entrada em cima, saída embaixo. F = folga. DOM = folga no domingo. Impresso em ${new Date().toLocaleString("pt-BR")}.</p>`;
  window.print();
}
function baixarExcel() {
  if (!window.XLSX) { toast("O Excel ainda está carregando. Tente de novo em alguns segundos."); return; }
  const linhas = [[`${ESC.loja_nome} · escala de ${mesTxt(ESC.mes)}${ESC.status === "lancada" ? " · lançada" : " · rascunho"}`], [], ["Setor", "Nome", "Horas/semana", ...E.dias.map((x) => `${DIAS_CURTO[x.w]} ${dataTxt(x)}`)]];
  setoresDe(E).forEach((s) => E.pessoas.filter((p) => !p.fora && p.setor === s).forEach((p) => linhas.push([s, nomeExp(p), p.horas, ...E.dias.map((x, i) => celTxt(x, p.dias[i]))])));
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 8 }, ...E.dias.map(() => ({ wch: 12 }))];
  ws["!freeze"] = { xSplit: 3, ySplit: 3 };
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Escala");
  const det = [["Nome", "Data", "Dia", "Situação", "Entrada", "Intervalo", "Volta", "Saída", "Horas"]];
  E.pessoas.filter((p) => !p.fora).forEach((p) => E.dias.forEach((x, i) => { const c = p.dias[i]; det.push([nomeExp(p), dataTxt(x), DIAS_CURTO[x.w], c.t === "T" ? "trabalha" : c.t === "X" ? "feriado" : c.t === "N" ? "ainda não entrou" : c.t === "L" ? "diarista não vem" : c.t === "A" ? "afastado" : c.t === "V" ? "férias" : "folga", c.t === "T" ? hm(c.ini) : "", c.alm ? hm(c.alm[0]) : "", c.alm ? hm(c.alm[1]) : "", c.t === "T" ? hm(c.fim) : "", c.t === "T" ? horasTxt(trabDe(c)) : ""]); }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(det), "Dia a dia");
  XLSX.writeFile(wb, `Escala ${ESC.loja_nome} ${ESC.mes}.xlsx`);
}

iniciar();
