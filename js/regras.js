/* ================= Regras: conferem a escala enquanto o gerente mexe =================
   "erro"  = quebra lei, acordo coletivo ou regra da empresa: precisa arrumar antes de lançar.
   "aviso" = vale olhar, mas pode lançar assim. */
"use strict";
const DIAS_SEM = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const DIAS_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const LETRA = ["D", "S", "T", "Q", "Q", "S", "S"];
const hm = (m) => { if (m == null) return ""; m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
const minDe = (s) => { if (s == null || s === "") return null; if (typeof s === "number") return s; const [h, m] = String(s).split(":").map(Number); return h * 60 + (m || 0); };
const horasTxt = (m) => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`; };
const dataTxt = (x) => String(x.d).padStart(2, "0") + "/" + x.iso.slice(5, 7);
const trabDe = (c) => (c && c.t === "T" ? c.fim - c.ini - (c.alm ? c.alm[1] - c.alm[0] : 0) : 0);
const limiteDia = (p) => Math.round((p.horas * 60) / 5);
/* dias em que a pessoa não está por motivo que não é folga: X = feriado com loja fechada, A = afastado (atestado, INSS, saiu), V = férias, N = ainda não entrou (vaga antes do dia de início) */
const AUSENCIA = ["X", "A", "V", "N"];
/* setores que podem entrar antes da abertura ou sair depois do fechamento quando o gerente mexe (vira aviso, não trava) */
const SETORES_HORARIO_LIVRE = ["Gerência", "Açougue", "Produção"];
const ehFolga = (c) => c && (c.t === "F" || c.t === "D");
const ativos = (E) => E.pessoas.filter((p) => !p.fora);

/* intervalo que a lei pede para cada tamanho de jornada */
function intervaloPedido(trab) { return trab > 360 ? 60 : trab > 240 ? 15 : 0; }
/* monta um dia de trabalho a partir de entrada, saída e almoço */
function montarDia(ini, fim, almIni, almDur) {
  const c = { t: "T", ini, fim, alm: null };
  if (almDur > 0) { let a = almIni == null ? Math.round((ini + (fim - ini) / 2 - almDur / 2) / 15) * 15 : almIni; a = Math.max(ini + 60, Math.min(a, fim - almDur - 60)); c.alm = [a, a + almDur]; }
  return c;
}
/* saída que fecha a jornada certa a partir da entrada */
function saidaPara(p, ini, almDur) { return ini + limiteDia(p) + almDur; }

function validarPessoa(E, p, o) {
  const out = [], R = E.regras || {}, L = E.loja;
  const add = (nivel, dia, texto, explica) => out.push({ nivel, pessoa: p.id, dia, texto, explica });
  const lim = limiteDia(p);
  const saidaMax = minDe(p.saidaMax), entradaMin = minDe(p.entradaMin);
  let seguidos = 0, fimAnt = null, domFolga = 0, domAntTrab = false;
  E.dias.forEach((x, i) => {
    const c = p.dias[i];
    if (c.t === "T") {
      const trab = trabDe(c), alm = c.alm ? c.alm[1] - c.alm[0] : 0;
      if (x.fechado) add("erro", i, "Escalado com a loja fechada", `A loja não abre em ${dataTxt(x)}${x.feriado ? " (" + x.feriado + ")" : ""}. Marque folga.`);
      else if (!x.fixo) add("erro", i, "Domingo só com diaristas", "Nesta loja o domingo é feito só por diaristas. A equipe fica de folga.");
      if (!x.fechado && x.ws != null) {
        const entraCedo = Math.min(x.ws, p.entradaAtual ?? 9999);
        // gerência, açougue e produção às vezes entram antes ou saem depois: o gerente pode mudar à mão (fica só o aviso)
        const livre = SETORES_HORARIO_LIVRE.includes(p.setor), nv = livre ? "aviso" : "erro", ex = livre ? " Gerência, açougue e produção podem passar disso quando precisar." : "";
        if (c.ini < entraCedo) add(nv, i, `Entra antes das ${hm(entraCedo)}`, `A loja abre às ${hm(x.abre)}. A equipe entra no máximo 15 min antes (${hm(x.ws)}).${ex}`);
        if (c.fim > x.we) add(nv, i, `Sai depois das ${hm(x.we)}`, `A loja fecha às ${hm(x.fecha)}. A equipe sai no máximo 15 min depois (${hm(x.we)}).${ex}`);
      }
      if (trab > 600) add("erro", i, `Trabalha ${horasTxt(trab)} no dia`, "O máximo por lei é 10h no dia (8h + 2h extras). CLT art. 59.");
      else if (trab > lim) add("erro", i, `Passou de ${horasTxt(lim)} no dia`, `Quem é ${p.horas}h por semana trabalha até ${horasTxt(lim)} por dia. Acima disso vira hora extra.`);
      if (trab > 360 && alm < 45) add("erro", i, "Almoço menor que 45 min", "Quem trabalha mais de 6h precisa de almoço de 45 min a 2h (acordo coletivo, cl. 22).");
      if (alm > 120) add("erro", i, "Almoço maior que 2h", "O almoço pode ir até 2h (acordo coletivo, cl. 22).");
      if (trab > 240 && trab <= 360 && alm < 15) add("erro", i, "Falta a pausa de 15 min", "Quem trabalha de 4h a 6h precisa de pausa de 15 min (CLT art. 71).");
      if (c.fim <= c.ini) add("erro", i, "Saída antes da entrada", "Confira os horários do dia.");
      if (fimAnt != null && c.ini + 1440 - fimAnt < (R.interjornada || 660)) add("erro", i, "Menos de 11h de descanso", `Saiu às ${hm(fimAnt)} no dia anterior e entra às ${hm(c.ini)}. Entre um turno e outro precisa de 11h (CLT art. 66).`);
      seguidos++;
      if (seguidos === (R.maxSeguidos || 5) + 1) add("erro", i, `Mais de ${R.maxSeguidos || 5} dias seguidos`, "Na escala 5x2 a pessoa trabalha no máximo 5 dias seguidos antes de folgar.");
      fimAnt = c.fim;
      if (x.w === 0) {
        if (domAntTrab) add("erro", i, "Dois domingos seguidos trabalhados", "Regra da empresa: não trabalhar dois domingos seguidos.");
        domAntTrab = true;
        if (p.horas === 30) add("erro", i, "Quem é 30h folga todo domingo", "Regra da empresa: quem era 36h e passou a 30h folga todo domingo. A folga da semana fica num dia de segunda a sexta.");
        else if (p.semDomingo) add("erro", i, "Esta pessoa não trabalha domingo", "Combinado com a pessoa: não trabalha aos domingos.");
      }
      if (x.feriado && p.semFeriado) add("erro", i, "Esta pessoa não trabalha feriado", "Combinado com a pessoa: não trabalha em feriado.");
      if (entradaMin != null && c.ini < entradaMin) add("erro", i, `Entra antes das ${hm(entradaMin)}`, `Combinado com a pessoa: entra a partir das ${hm(entradaMin)}.`);
      if (saidaMax != null && x.ws != null) {
        const tol = Math.max(saidaMax, Math.min(x.ws, p.entradaAtual ?? 9999) + trab + 60);
        if (c.fim > tol) add("erro", i, `Sai depois das ${hm(saidaMax)}`, `Combinado com a pessoa: sai até as ${hm(saidaMax)}.`);
      }
      if (p.turno === "M" && c.fim > 1120) add("aviso", i, "Turno da manhã saindo depois de 18h40", "Esta pessoa é do turno da manhã.");
      if (p.turno === "T" && x.we != null && c.fim < x.we) add("aviso", i, "Turno da tarde não fecha a loja", "Esta pessoa é do turno da tarde e costuma fechar a loja.");
      if (p.entradaAtual != null && Math.abs(c.ini - p.entradaAtual) > 60) add("aviso", i, `Horário bem diferente do de hoje`, `Hoje esta pessoa entra às ${hm(p.entradaAtual)}. Mudança de mais de 1h no horário: combine antes com ela.`);
    } else {
      if (x.w === 6 && x.fixo && !x.feriado && !AUSENCIA.includes(c.t)) add("erro", i, "Folga no sábado", "Regra da empresa: ninguém folga no sábado. Troque a folga para um dia de segunda a sexta.");
      seguidos = 0; fimAnt = null;
      if (x.w === 0) { domFolga++; domAntTrab = false; }
    }
  });
  const minDom = R.domingosFolgaMin || 2, domingos = E.dias.filter((x) => x.w === 0).length;
  if (domFolga < Math.min(minDom, domingos)) add("erro", null, `Só ${domFolga} domingo(s) de folga no mês`, `Regra da empresa: pelo menos ${minDom} domingos de folga no mês.`);
  (E.semanas || []).forEach((S) => {
    if (!S.cheia) return;
    const folgas = S.dias.filter((i) => ehFolga(p.dias[i])).length;
    const fer = S.dias.filter((i) => AUSENCIA.includes(p.dias[i].t)).length; // feriado fechado, afastamento e férias não contam como folga
    const min = S.dias.reduce((a, i) => a + trabDe(p.dias[i]), 0);
    const ini = E.dias[S.dias[0]], fim = E.dias[S.dias[S.dias.length - 1]];
    const sem = `semana de ${dataTxt(ini)} a ${dataTxt(fim)}`;
    if (folgas + fer < 2) add("erro", S.dias[0], `Só ${folgas} folga na ${sem}`, "Na escala 5x2 são 2 folgas por semana.");
    if (min > p.horas * 60) add("erro", S.dias[0], `${horasTxt(min)} na ${sem}`, `O contrato é de ${p.horas}h por semana. Passou ${horasTxt(min - p.horas * 60)}.`);
    else if (fer === 0 && min < (o && o.horas === p.horas ? Math.min(p.horas * 60, S.dias.reduce((a, i) => a + trabDe(o.dias[i]), 0)) : p.horas * 60) - 30) add("aviso", S.dias[0], `Faltam ${horasTxt(p.horas * 60 - min)} na ${sem}`, `O contrato é de ${p.horas}h por semana e a escala dá ${horasTxt(min)}. Pode ficar assim, mas a pessoa recebe pelas ${p.horas}h.`);
  });
  return out;
}

/* presença por meia hora (equipe + diaristas) */
function presenca(E, i, setor) {
  const x = E.dias[i]; if (x.fechado || x.abre == null) return null;
  const slots = []; for (let t = x.abre; t < x.fecha; t += 30) slots.push(t);
  const cont = slots.map(() => 0);
  const soma = (ini, fim, alm) => slots.forEach((t, k) => { if (t >= ini && t + 30 <= fim + 0 && !(alm && t >= alm[0] && t < alm[1])) cont[k]++; });
  // "AbreFecha" = gerentes + quem foi marcado como substituto do gerente
  ativos(E).forEach((p) => { const c = p.dias[i]; if (c.t === "T" && (setor === "*" || p.setor === setor || (setor === "Liderança" && (p.setor === "Gerência" || p.setor === "Fiscal")) || (setor === "AbreFecha" && (p.setor === "Gerência" || p.subGerente)))) soma(c.ini, c.fim, c.alm); });
  (E.diaristas || []).forEach((d) => { if (d.dia === x.d && (setor === "*" || d.setor === setor)) soma(d.ini, d.fim, null); });
  return { slots, cont };
}

const SETORES_OBRIGATORIOS = [["Operadora", "operadora de caixa"], ["Açougue", "açougue"], ["Padaria", "padaria"], ["Fiscal", "fiscal de caixa"]];
function avisosLoja(E) {
  // regra da empresa (26/11/2026): com a loja aberta, nenhum horário sem operadora de caixa, açougue, padaria e fiscal de caixa
  const out = [];
  const checar = SETORES_OBRIGATORIOS;
  E.dias.forEach((x, i) => {
    if (x.fechado || x.abre == null) return;
    checar.forEach(([s, nome]) => {
      const pr = presenca(E, i, s); if (!pr) return;
      let ini = null;
      pr.cont.forEach((n, k) => {
        if (n === 0 && ini == null) ini = pr.slots[k];
        if ((n > 0 || k === pr.cont.length - 1) && ini != null) {
          const fim = n > 0 ? pr.slots[k] : pr.slots[k] + 30;
          out.push({ nivel: "cobertura", pessoa: null, dia: i, setor: s, texto: `Sem ${nome} das ${hm(ini)} às ${hm(fim)}`, explica: "Regra da empresa: com a loja aberta, sempre tem que ter operadora de caixa, açougue, padaria e fiscal de caixa. Mude o almoço de alguém, a entrada/saída ou a folga; se não tiver gente no setor, chame diarista ou fale com o escritório." });
          ini = null;
        }
      });
    });
    // regra da empresa (26/11/2026, obrigatória): pelo menos 1 gerente (ou substituto marcado) na abertura e 1 no fechamento
    if (x.fixo) {
      const pg = presenca(E, i, "AbreFecha");
      if (pg && pg.cont.length) {
        const explica = "Regra obrigatória: todo dia tem que ter 1 gerente abrindo e 1 fechando a loja. Ajuste a entrada/saída ou a folga dos gerentes. Se a loja não tem gerentes suficientes, marque um substituto (ex.: fiscal ou encarregado) na aba Equipe e coloque essa pessoa para abrir ou fechar.";
        if (pg.cont[0] === 0) out.push({ nivel: "erro", pessoa: null, dia: i, setor: "Gerência", texto: `Sem gerente na abertura (${hm(x.abre)})`, explica });
        if (pg.cont[pg.cont.length - 1] === 0) out.push({ nivel: "erro", pessoa: null, dia: i, setor: "Gerência", texto: `Sem gerente no fechamento (${hm(x.fecha)})`, explica });
      }
    }
  });
  return out;
}

/* Índice de cobertura da loja no mês.
   geral = parte da necessidade (pessoas que o movimento pede, hora a hora, setor por setor) que a escala atende, descontando os intervalos.
   obrig = parte do tempo de loja aberta com operadora, açougue, padaria e fiscal ao mesmo tempo. */
function indiceCobertura(E, nec, horas) {
  let pede = 0, atende = 0, falta = 0, sobra = 0, meias = 0, meiasOk = 0;
  const porSetor = {};
  if (!nec || !horas) return null;
  E.dias.forEach((x, i) => {
    if (x.fechado || x.abre == null) return;
    Object.keys(nec).forEach((s) => {
      const n = nec[s] && nec[s][i]; if (!n) return;
      const pr = presenca(E, i, s); if (!pr) return;
      horas.forEach((h, k) => {
        const v = n[k]; if (v == null) return;
        const ks = []; pr.slots.forEach((t, j) => { if (t >= h * 60 && t < h * 60 + 60) ks.push(j); });
        if (!ks.length) return;
        const e = ks.reduce((a, j) => a + pr.cont[j], 0) / ks.length;
        pede += v; atende += Math.min(e, v); falta += Math.max(0, v - e); sobra += Math.max(0, e - v);
        const ps = (porSetor[s] = porSetor[s] || { pede: 0, atende: 0 }); ps.pede += v; ps.atende += Math.min(e, v);
      });
    });
    const prs = SETORES_OBRIGATORIOS.map(([s]) => presenca(E, i, s));
    prs[0].slots.forEach((t, j) => { meias++; if (prs.every((p) => p.cont[j] > 0)) meiasOk++; });
  });
  const setores = Object.entries(porSetor).map(([s, v]) => ({ setor: s, pct: v.pede ? v.atende / v.pede : 1 })).sort((a, b) => a.pct - b.pct);
  return { geral: pede ? atende / pede : 1, obrig: meias ? meiasOk / meias : 1, horasFaltando: falta, horasSobrando: sobra, setores };
}

function validarTudo(E, P) {
  const porPessoa = {}, lista = [], pad = P ? Object.fromEntries(P.pessoas.map((p) => [p.id, p])) : {};
  ativos(E).forEach((p) => { const v = validarPessoa(E, p, pad[p.id]); porPessoa[p.id] = v; lista.push(...v); });
  lista.push(...avisosLoja(E));
  return { porPessoa, lista, erros: lista.filter((v) => v.nivel === "erro"), avisos: lista.filter((v) => v.nivel === "aviso"), cobertura: lista.filter((v) => v.nivel === "cobertura") };
}

/* diferenças entre a escala do gerente e a padrão */
const mesmoDia = (a, b) => a.t === b.t && (a.t !== "T" || (a.ini === b.ini && a.fim === b.fim && JSON.stringify(a.alm || null) === JSON.stringify(b.alm || null)));
const diaTxt = (c) => (c.t === "T" ? `${hm(c.ini)} às ${hm(c.fim)}` : c.t === "D" ? "folga (domingo)" : c.t === "X" ? "feriado" : c.t === "A" ? "afastado" : c.t === "V" ? "férias" : c.t === "N" ? "ainda não entrou" : "folga");
function mudancas(E, P) {
  const out = [], pad = Object.fromEntries(P.pessoas.map((p) => [p.id, p]));
  E.pessoas.forEach((p) => {
    const o = pad[p.id];
    if (!o) { if (!p.fora) out.push({ pessoa: p.id, tipo: "nova", texto: `Incluída na escala (${p.setor}, ${p.horas}h)` }); return; }
    if (p.fora) { out.push({ pessoa: p.id, tipo: "fora", texto: `Tirada da escala${p.fora.motivo ? ": " + p.fora.motivo : ""}` }); return; }
    if (p.horas !== o.horas) out.push({ pessoa: p.id, tipo: "horas", texto: `Contrato de ${o.horas}h passou para ${p.horas}h por semana` });
    if (p.setor !== o.setor) out.push({ pessoa: p.id, tipo: "setor", texto: `Setor ${o.setor} passou para ${p.setor}` });
    E.dias.forEach((x, i) => { if (!mesmoDia(p.dias[i], o.dias[i])) out.push({ pessoa: p.id, tipo: "dia", dia: i, texto: `${DIAS_CURTO[x.w]} ${dataTxt(x)}: era ${diaTxt(o.dias[i])}, agora ${diaTxt(p.dias[i])}` }); });
  });
  return out;
}

if (typeof module !== "undefined") module.exports = { indiceCobertura, hm, minDe, trabDe, validarPessoa, validarTudo, avisosLoja, mudancas, presenca, montarDia, saidaPara, limiteDia, intervaloPedido };
