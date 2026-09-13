const selectSemana = document.getElementById("semana");
const btnMostrar = document.getElementById("mostrar");
const statusEl = document.getElementById("status");
const resultado = document.getElementById("resultado");
const corpoTabela = document.getElementById("corpoTabela");
const tituloTabela = document.getElementById("tituloTabela");

let escalas = {};

function formatarDataISO(iso) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function carregarEscalas() {
  try {
    const resposta = await fetch(`escalas.json?v=${Date.now()}`);
    if (!resposta.ok) throw new Error("Não foi possível carregar escalas.json");

    escalas = await resposta.json();
    const semanas = Object.keys(escalas).sort();

    selectSemana.innerHTML = "";

    if (!semanas.length) {
      selectSemana.innerHTML = '<option value="">Nenhuma escala publicada</option>';
      statusEl.textContent = "Ainda não há escalas disponíveis.";
      return;
    }

    for (const semana of semanas) {
      const option = document.createElement("option");
      option.value = semana;
      option.textContent = formatarDataISO(semana);
      selectSemana.appendChild(option);
    }

    selectSemana.value = semanas[semanas.length - 1];
    mostrarEscala();
  } catch (erro) {
    console.error(erro);
    selectSemana.innerHTML = '<option value="">Erro ao carregar</option>';
    statusEl.textContent = "Não foi possível carregar as escalas.";
  }
}

function classeTarefa(valor, quarta = false) {
  if (quarta) return "wednesday";
  if (valor === "FOLGA") return "folga";
  if (valor === "AUSENTE") return "ausente";
  return "task";
}

function textoTarefa(valor) {
  if (valor === "FOLGA") return "";
  return valor || "";
}

function mostrarEscala() {
  const semana = selectSemana.value;

  if (!semana || !escalas[semana]) {
    resultado.hidden = true;
    statusEl.textContent = "Selecione uma semana válida.";
    return;
  }

  const escala = escalas[semana];
  const pessoas = escala.pessoas || {};

  tituloTabela.textContent = `TABELA DE TAREFAS - ${formatarDataISO(semana)}`;
  corpoTabela.innerHTML = "";

  Object.entries(pessoas).forEach(([pessoa, tarefas]) => {
    const tr = document.createElement("tr");

    const nome = document.createElement("td");
    nome.className = "name";
    nome.textContent = pessoa;
    tr.appendChild(nome);

    const inicio = document.createElement("td");
    inicio.className = classeTarefa(tarefas.dom_seg_ter);
    inicio.textContent = textoTarefa(tarefas.dom_seg_ter);
    tr.appendChild(inicio);

    const quarta = document.createElement("td");
    quarta.className = classeTarefa("", true);
    quarta.textContent = "";
    tr.appendChild(quarta);

    const fim = document.createElement("td");
    fim.className = classeTarefa(tarefas.qui_sex_sab);
    fim.textContent = textoTarefa(tarefas.qui_sex_sab);
    tr.appendChild(fim);

    corpoTabela.appendChild(tr);
  });

  statusEl.textContent = escala.atualizada_em
    ? `Última atualização: ${escala.atualizada_em}`
    : "";

  resultado.hidden = false;
}

btnMostrar.addEventListener("click", mostrarEscala);
selectSemana.addEventListener("change", mostrarEscala);

carregarEscalas();
