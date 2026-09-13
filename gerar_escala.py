import random
import os
import itertools
import json
import subprocess
import shutil
import sys
from datetime import datetime

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side


# ============================================================
# CONFIGURAÇÕES
# ============================================================

PESSOAS = [
    "JUKEBOX",
    "LOTERYA",
    "KOMIXÃO",
    "NAMOITA",
    "NAZARÉ",
    "CAMILA",
    "BAQUETADA",
    "AMANDA",
    "BELA",
]

TAREFAS_INICIO = [
    "Área frontal da casa",
    "Sala e copa",
    "Cozinha",
    "Geladeira",
    "Lavanderia",
    "Panos",
]

TAREFAS_FIM = [
    "Cozinha",
    "Armários cozinha",
    "Área traseira da casa",
    "Garagem",
    "Sala e copa",
]

TAREFAS_DIFICEIS = {
    "Cozinha",
    "Armários cozinha",
    "Geladeira"
}

PROIBIDO_PANOS = {
    "NAZARÉ",
    "CAMILA",
}


# ============================================================
# ARQUIVOS
# ============================================================

PASTA_SCRIPT = os.path.dirname(os.path.abspath(__file__))

ARQUIVO_HISTORICO = os.path.join(
    PASTA_SCRIPT,
    "historico_limpeza.csv",
)

ARQUIVO_JSON = os.path.join(
    PASTA_SCRIPT,
    "escalas.json",
)


def caminho_xlsx(data_semana):
    return os.path.join(
        PASTA_SCRIPT,
        f"escala_limpeza_{data_semana.strftime('%d_%m_%Y')}.xlsx",
    )


# ============================================================
# CONFIGURAÇÃO DO GIT
# ============================================================
#
# O script pressupõe que:
# 1. esta pasta já é um repositório Git;
# 2. existe um remote chamado "origin";
# 3. você já consegue executar "git push" normalmente
#    no terminal, via Git Credential Manager ou SSH.
#
# NÃO coloque token/senha dentro deste arquivo.
# ============================================================

GIT_REMOTE = "origin"
GIT_BRANCH = "main"
FAZER_PUSH_AUTOMATICO = True


def encontrar_git():

    git = shutil.which("git")

    if git:
        return git

    caminhos_possiveis = [
        r"C:\Program Files\Git\cmd\git.exe",
        r"C:\Program Files\Git\bin\git.exe",
        r"C:\Program Files (x86)\Git\cmd\git.exe",
        r"C:\Program Files (x86)\Git\bin\git.exe",
    ]

    for caminho in caminhos_possiveis:

        if os.path.exists(caminho):
            return caminho

    raise FileNotFoundError(
        "O Git não foi encontrado no computador."
    )


GIT_EXECUTAVEL = encontrar_git()


# ============================================================
# SEMANA FIXA 06/09/2026
# ============================================================

ESCALA_FIXA_06_09 = {
    "JUKEBOX": {
        "DOM/SEG/TER": "Área frontal da casa",
        "QUI/SEX/SÁB": "Cozinha",
    },
    "LOTERYA": {
        "DOM/SEG/TER": "Sala e copa",
        "QUI/SEX/SÁB": "Armários cozinha",
    },
    "KOMIXÃO": {
        "DOM/SEG/TER": "Cozinha",
        "QUI/SEX/SÁB": "FOLGA",
    },
    "NAMOITA": {
        "DOM/SEG/TER": "Geladeira",
        "QUI/SEX/SÁB": "Área traseira da casa",
    },
    "NAZARÉ": {
        "DOM/SEG/TER": "Lavanderia",
        "QUI/SEX/SÁB": "FOLGA",
    },
    "CAMILA": {
        "DOM/SEG/TER": "FOLGA",
        "QUI/SEX/SÁB": "Garagem",
    },
    "BAQUETADA": {
        "DOM/SEG/TER": "Panos",
        "QUI/SEX/SÁB": "Sala e copa",
    },
    "AMANDA": {
        "DOM/SEG/TER": "FOLGA",
        "QUI/SEX/SÁB": "FOLGA",
    },
    "BELA": {
        "DOM/SEG/TER": "FOLGA",
        "QUI/SEX/SÁB": "FOLGA",
    },
}


# ============================================================
# HISTÓRICO
# ============================================================

def carregar_historico():
    colunas = [
        "semana",
        "pessoa",
        "dom_seg_ter",
        "qui_sex_sab",
    ]

    if not os.path.exists(ARQUIVO_HISTORICO):
        return pd.DataFrame(columns=colunas)

    historico = pd.read_csv(
        ARQUIVO_HISTORICO,
        encoding="utf-8-sig",
    )

    for coluna in colunas:
        if coluna not in historico.columns:
            historico[coluna] = ""

    return historico[colunas].fillna("")


def salvar_historico(historico):
    historico.to_csv(
        ARQUIVO_HISTORICO,
        index=False,
        encoding="utf-8-sig",
    )


def ordenar_historico(historico):
    if historico.empty:
        return historico

    temp = historico.copy()

    temp["_data"] = pd.to_datetime(
        temp["semana"],
        format="%d/%m/%Y",
        errors="coerce",
    )

    ordem = {
        pessoa: i
        for i, pessoa in enumerate(PESSOAS)
    }

    temp["_ordem_pessoa"] = temp["pessoa"].map(ordem)

    temp = temp.sort_values([
        "_data",
        "_ordem_pessoa",
    ])

    return (
        temp
        .drop(columns=["_data", "_ordem_pessoa"])
        .reset_index(drop=True)
    )


def garantir_semana_fixa(historico):
    data_fixa = "06/09/2026"

    historico = historico[
        historico["semana"] != data_fixa
    ].copy()

    registros = []

    for pessoa in PESSOAS:
        registros.append({
            "semana": data_fixa,
            "pessoa": pessoa,
            "dom_seg_ter": ESCALA_FIXA_06_09[pessoa]["DOM/SEG/TER"],
            "qui_sex_sab": ESCALA_FIXA_06_09[pessoa]["QUI/SEX/SÁB"],
        })

    historico = pd.concat(
        [historico, pd.DataFrame(registros)],
        ignore_index=True,
    )

    return ordenar_historico(historico)


def historico_antes_da_data(historico, data_nova):
    if historico.empty:
        return historico.copy()

    datas = pd.to_datetime(
        historico["semana"],
        format="%d/%m/%Y",
        errors="coerce",
    )

    return historico[datas < data_nova].copy()


# ============================================================
# HISTÓRICO RECENTE
# ============================================================

def ultimas_semanas_participadas(
    historico,
    pessoa,
    quantidade=2,
):
    dados = historico[
        historico["pessoa"] == pessoa
    ].copy()

    if dados.empty:
        return []

    dados = dados[
        ~(
            (dados["dom_seg_ter"] == "AUSENTE")
            &
            (dados["qui_sex_sab"] == "AUSENTE")
        )
    ].copy()

    if dados.empty:
        return []

    dados["_data"] = pd.to_datetime(
        dados["semana"],
        format="%d/%m/%Y",
        errors="coerce",
    )

    dados = dados.sort_values(
        "_data",
        ascending=False,
    )

    return [
        linha
        for _, linha in dados.head(quantidade).iterrows()
    ]


def fez_tarefa_nas_ultimas_semanas(
    historico,
    pessoa,
    tarefa,
    quantidade=1,
):
    semanas = ultimas_semanas_participadas(
        historico,
        pessoa,
        quantidade,
    )

    for semana in semanas:
        if (
            semana["dom_seg_ter"] == tarefa
            or semana["qui_sex_sab"] == tarefa
        ):
            return True

    return False


def ultima_semana_participada(historico, pessoa):
    semanas = ultimas_semanas_participadas(
        historico,
        pessoa,
        quantidade=1,
    )

    return semanas[0] if semanas else None


def pessoas_com_folga_obrigatoria(
    historico,
    presentes,
):
    obrigatorias = []

    for pessoa in presentes:
        ultima = ultima_semana_participada(
            historico,
            pessoa,
        )

        if ultima is None:
            continue

        teve_folga = (
            ultima["dom_seg_ter"] == "FOLGA"
            or ultima["qui_sex_sab"] == "FOLGA"
        )

        if not teve_folga:
            obrigatorias.append(pessoa)

    return obrigatorias


# ============================================================
# CONTAGENS
# ============================================================

def tarefas_da_pessoa(historico, pessoa):
    tarefas = []

    registros = historico[
        historico["pessoa"] == pessoa
    ]

    for _, linha in registros.iterrows():
        for coluna in ["dom_seg_ter", "qui_sex_sab"]:
            tarefa = linha[coluna]

            if tarefa not in ["", "AUSENTE"]:
                tarefas.append(tarefa)

    return tarefas


def quantidade_tarefa(historico, pessoa, tarefa):
    return tarefas_da_pessoa(
        historico,
        pessoa,
    ).count(tarefa)


def quantidade_folgas(historico, pessoa):
    return quantidade_tarefa(
        historico,
        pessoa,
        "FOLGA",
    )


def quantidade_dificeis(historico, pessoa):
    return sum(
        quantidade_tarefa(
            historico,
            pessoa,
            tarefa,
        )
        for tarefa in TAREFAS_DIFICEIS
    )


def quantidade_total_tarefas(historico, pessoa):
    return sum(
        tarefa != "FOLGA"
        for tarefa in tarefas_da_pessoa(
            historico,
            pessoa,
        )
    )


# ============================================================
# REGRAS DE TAREFA
# ============================================================

def tarefa_permitida(pessoa, tarefa):
    if (
        tarefa == "Panos"
        and pessoa in PROIBIDO_PANOS
    ):
        return False

    return True


def ultima_tarefa_executada(historico, pessoa):
    dados = historico[
        historico["pessoa"] == pessoa
    ].copy()

    if dados.empty:
        return None

    dados["_data"] = pd.to_datetime(
        dados["semana"],
        format="%d/%m/%Y",
        errors="coerce",
    )

    dados = dados.sort_values(
        "_data",
        ascending=False,
    )

    for _, linha in dados.iterrows():
        for coluna in [
            "qui_sex_sab",
            "dom_seg_ter",
        ]:
            tarefa = linha[coluna]

            if tarefa not in [
                "",
                "FOLGA",
                "AUSENTE",
            ]:
                return tarefa

    return None


def pode_receber_tarefa_dificil(
    historico,
    pessoa,
    escala_anterior=None,
):
    # Se existe um bloco anterior na semana atual e a pessoa
    # trabalhou nele, essa é a tarefa imediatamente anterior.
    if escala_anterior is not None:
        tarefa_anterior = escala_anterior.get(pessoa)

        if tarefa_anterior not in [
            None,
            "",
            "FOLGA",
            "AUSENTE",
        ]:
            return tarefa_anterior not in TAREFAS_DIFICEIS

    # Se a pessoa folgou no bloco anterior, ou estamos distribuindo
    # o primeiro bloco da semana, busca a última tarefa realmente
    # executada no histórico.
    tarefa_anterior = ultima_tarefa_executada(
        historico,
        pessoa,
    )

    return tarefa_anterior not in TAREFAS_DIFICEIS


def escolher_pessoa(
    candidatos,
    tarefa,
    historico,
    escala_anterior=None,
):
    candidatos = [
        pessoa
        for pessoa in candidatos
        if tarefa_permitida(
            pessoa,
            tarefa,
        )
    ]

    if not candidatos:
        raise ValueError(
            f"Não há pessoa disponível para a tarefa '{tarefa}'."
        )

    # REGRA OBRIGATÓRIA:
    # quem fez uma tarefa difícil imediatamente antes
    # não pode receber outra tarefa difícil em seguida.
    if tarefa in TAREFAS_DIFICEIS:
        candidatos = [
            pessoa
            for pessoa in candidatos
            if pode_receber_tarefa_dificil(
                historico,
                pessoa,
                escala_anterior,
            )
        ]

        if not candidatos:
            raise ValueError(
                "Não foi possível distribuir a tarefa difícil "
                f"'{tarefa}' sem colocar duas tarefas difíceis "
                "seguidas para a mesma pessoa."
            )

    candidatos_originais = candidatos.copy()

    # 1. Evita a tarefa da última semana
    sem_rep_1 = [
        pessoa
        for pessoa in candidatos
        if not fez_tarefa_nas_ultimas_semanas(
            historico,
            pessoa,
            tarefa,
            quantidade=1,
        )
    ]

    if sem_rep_1:
        candidatos = sem_rep_1
    else:
        candidatos = candidatos_originais.copy()

    # 2. Evita também as duas últimas semanas, se possível
    sem_rep_2 = [
        pessoa
        for pessoa in candidatos
        if not fez_tarefa_nas_ultimas_semanas(
            historico,
            pessoa,
            tarefa,
            quantidade=2,
        )
    ]

    if sem_rep_2:
        candidatos = sem_rep_2

    # 3. Quem menos fez a tarefa
    menor_tarefa = min(
        quantidade_tarefa(
            historico,
            pessoa,
            tarefa,
        )
        for pessoa in candidatos
    )

    candidatos = [
        pessoa
        for pessoa in candidatos
        if quantidade_tarefa(
            historico,
            pessoa,
            tarefa,
        ) == menor_tarefa
    ]

    # 4. Tarefa difícil
    if tarefa in TAREFAS_DIFICEIS:
        menor_dificil = min(
            quantidade_dificeis(
                historico,
                pessoa,
            )
            for pessoa in candidatos
        )

        candidatos = [
            pessoa
            for pessoa in candidatos
            if quantidade_dificeis(
                historico,
                pessoa,
            ) == menor_dificil
        ]

    # 5. Menor quantidade total de tarefas
    menor_total = min(
        quantidade_total_tarefas(
            historico,
            pessoa,
        )
        for pessoa in candidatos
    )

    candidatos = [
        pessoa
        for pessoa in candidatos
        if quantidade_total_tarefas(
            historico,
            pessoa,
        ) == menor_total
    ]

    return random.choice(candidatos)


# ============================================================
# FOLGAS
# ============================================================

def escolher_folgas(
    presentes,
    folgas_obrigatorias,
    historico,
    data_semana,
):
    qtd_presentes = len(presentes)

    qtd_folgas_inicio = (
        qtd_presentes
        - len(TAREFAS_INICIO)
    )

    qtd_folgas_fim = (
        qtd_presentes
        - len(TAREFAS_FIM)
    )

    if qtd_folgas_inicio < 0:
        raise ValueError(
            "Não há pessoas suficientes para as 6 tarefas de DOM/SEG/TER."
        )

    if qtd_folgas_fim < 0:
        raise ValueError(
            "Não há pessoas suficientes para as 5 tarefas de QUI/SEX/SÁB."
        )

    total_vagas = qtd_folgas_inicio + qtd_folgas_fim

    if len(folgas_obrigatorias) > total_vagas:
        raise ValueError(
            "Não é possível cumprir todas as folgas obrigatórias nesta semana."
        )

    possibilidades = []

    for folga_inicio_tuple in itertools.combinations(
        presentes,
        qtd_folgas_inicio,
    ):
        folga_inicio = set(folga_inicio_tuple)

        # 13/09: Komixão = Panos
        if (
            data_semana == datetime(2026, 9, 13)
            and "KOMIXÃO" in folga_inicio
        ):
            continue

        for folga_fim_tuple in itertools.combinations(
            presentes,
            qtd_folgas_fim,
        ):
            folga_fim = set(folga_fim_tuple)

            pessoas_com_folga = (
                folga_inicio | folga_fim
            )

            if not set(
                folgas_obrigatorias
            ).issubset(
                pessoas_com_folga
            ):
                continue

            score = 0

            for pessoa in folga_inicio:
                score += (
                    quantidade_folgas(
                        historico,
                        pessoa,
                    ) * 10
                )

            for pessoa in folga_fim:
                score += (
                    quantidade_folgas(
                        historico,
                        pessoa,
                    ) * 10
                )

            score += (
                len(folga_inicio & folga_fim)
                * 30
            )

            score += random.random()

            possibilidades.append((
                score,
                folga_inicio,
                folga_fim,
            ))

    if not possibilidades:
        raise ValueError(
            "Não foi encontrada uma combinação válida de folgas."
        )

    possibilidades.sort(key=lambda item: item[0])

    _, folga_inicio, folga_fim = possibilidades[0]

    return folga_inicio, folga_fim


# ============================================================
# DISTRIBUIÇÃO
# ============================================================

def distribuir_primeiro_bloco(
    presentes,
    folga_inicio,
    historico,
    data_semana,
):
    escala = {}

    disponiveis = [
        pessoa
        for pessoa in presentes
        if pessoa not in folga_inicio
    ]

    for pessoa in folga_inicio:
        escala[pessoa] = "FOLGA"

    tarefas = TAREFAS_INICIO.copy()

    # Regra especial 13/09/2026
    if data_semana == datetime(2026, 9, 13):
        if "KOMIXÃO" not in presentes:
            raise ValueError(
                "KOMIXÃO está ausente em 13/09/2026, "
                "mas precisa executar Panos."
            )

        escala["KOMIXÃO"] = "Panos"
        disponiveis.remove("KOMIXÃO")
        tarefas.remove("Panos")

    random.shuffle(tarefas)

    for tarefa in tarefas:
        pessoa = escolher_pessoa(
            disponiveis,
            tarefa,
            historico,
        )

        escala[pessoa] = tarefa
        disponiveis.remove(pessoa)

    return escala


def distribuir_segundo_bloco(
    presentes,
    folga_fim,
    escala_inicio,
    historico,
):
    escala = {}

    disponiveis = [
        pessoa
        for pessoa in presentes
        if pessoa not in folga_fim
    ]

    for pessoa in folga_fim:
        escala[pessoa] = "FOLGA"

    tarefas_dificeis = [
        "Cozinha",
        "Armários cozinha",
    ]

    random.shuffle(tarefas_dificeis)

    for tarefa in tarefas_dificeis:
        # Primeiro elimina quem teria duas tarefas difíceis seguidas.
        candidatos_validos = [
            pessoa
            for pessoa in disponiveis
            if pode_receber_tarefa_dificil(
                historico,
                pessoa,
                escala_inicio,
            )
        ]

        if not candidatos_validos:
            raise ValueError(
                "Não foi possível distribuir as tarefas difíceis "
                "sem repetir tarefa difícil em sequência."
            )

        # Entre os válidos, mantém a prioridade para quem folgou
        # no primeiro bloco.
        candidatos = [
            pessoa
            for pessoa in candidatos_validos
            if escala_inicio[pessoa] == "FOLGA"
        ]

        if not candidatos:
            candidatos = candidatos_validos.copy()

        sem_repeticao_mesma_semana = [
            pessoa
            for pessoa in candidatos
            if escala_inicio[pessoa] != tarefa
        ]

        if sem_repeticao_mesma_semana:
            candidatos = sem_repeticao_mesma_semana

        pessoa = escolher_pessoa(
            candidatos,
            tarefa,
            historico,
            escala_inicio,
        )

        escala[pessoa] = tarefa
        disponiveis.remove(pessoa)

    outras = [
        "Área traseira da casa",
        "Garagem",
        "Sala e copa",
    ]

    random.shuffle(outras)

    for tarefa in outras:
        candidatos = [
            pessoa
            for pessoa in disponiveis
            if escala_inicio[pessoa] != tarefa
        ]

        if not candidatos:
            candidatos = disponiveis.copy()

        pessoa = escolher_pessoa(
            candidatos,
            tarefa,
            historico,
        )

        escala[pessoa] = tarefa
        disponiveis.remove(pessoa)

    return escala


# ============================================================
# GERAR SEMANA
# ============================================================

def gerar_semana(data_semana, ausentes):
    historico = carregar_historico()
    historico = garantir_semana_fixa(historico)

    if data_semana == datetime(2026, 9, 6):
        escala1 = {
            pessoa: ESCALA_FIXA_06_09[pessoa]["DOM/SEG/TER"]
            for pessoa in PESSOAS
        }

        escala2 = {
            pessoa: ESCALA_FIXA_06_09[pessoa]["QUI/SEX/SÁB"]
            for pessoa in PESSOAS
        }

        return escala1, escala2, historico, []

    data_texto = data_semana.strftime("%d/%m/%Y")

    historico = historico[
        historico["semana"] != data_texto
    ].copy()

    historico_anterior = historico_antes_da_data(
        historico,
        data_semana,
    )

    presentes = [
        pessoa
        for pessoa in PESSOAS
        if pessoa not in ausentes
    ]

    if len(presentes) < 6:
        raise ValueError(
            "Não é possível gerar a escala: há menos de 6 pessoas presentes."
        )

    if (
        data_semana == datetime(2026, 9, 13)
        and "KOMIXÃO" in ausentes
    ):
        raise ValueError(
            "KOMIXÃO não pode estar ausente em 13/09/2026, "
            "pois precisa executar Panos."
        )

    folgas_obrigatorias = pessoas_com_folga_obrigatoria(
        historico_anterior,
        presentes,
    )

    folga_inicio, folga_fim = escolher_folgas(
        presentes,
        folgas_obrigatorias,
        historico_anterior,
        data_semana,
    )

    escala1 = distribuir_primeiro_bloco(
        presentes,
        folga_inicio,
        historico_anterior,
        data_semana,
    )

    escala2 = distribuir_segundo_bloco(
        presentes,
        folga_fim,
        escala1,
        historico_anterior,
    )

    for pessoa in ausentes:
        escala1[pessoa] = "AUSENTE"
        escala2[pessoa] = "AUSENTE"

    return (
        escala1,
        escala2,
        historico,
        folgas_obrigatorias,
    )


# ============================================================
# SALVAR CSV
# ============================================================

def salvar_semana_historico(
    historico,
    data_semana,
    escala1,
    escala2,
):
    data_texto = data_semana.strftime("%d/%m/%Y")

    historico = historico[
        historico["semana"] != data_texto
    ].copy()

    registros = []

    for pessoa in PESSOAS:
        registros.append({
            "semana": data_texto,
            "pessoa": pessoa,
            "dom_seg_ter": escala1[pessoa],
            "qui_sex_sab": escala2[pessoa],
        })

    historico = pd.concat(
        [historico, pd.DataFrame(registros)],
        ignore_index=True,
    )

    historico = ordenar_historico(historico)

    salvar_historico(historico)

    return historico


# ============================================================
# PUBLICAR NO JSON DO SITE
# ============================================================

def carregar_json_site():
    if not os.path.exists(ARQUIVO_JSON):
        return {}

    try:
        with open(
            ARQUIVO_JSON,
            "r",
            encoding="utf-8",
        ) as arquivo:
            return json.load(arquivo)
    except json.JSONDecodeError:
        return {}


def atualizar_json_site(
    data_semana,
    escala1,
    escala2,
):
    escalas = carregar_json_site()

    chave = data_semana.strftime("%Y-%m-%d")

    escalas[chave] = {
        "atualizada_em": datetime.now().strftime(
            "%d/%m/%Y %H:%M"
        ),
        "pessoas": {
            pessoa: {
                "dom_seg_ter": escala1[pessoa],
                "qui_sex_sab": escala2[pessoa],
            }
            for pessoa in PESSOAS
        },
    }

    escalas = dict(
        sorted(escalas.items())
    )

    with open(
        ARQUIVO_JSON,
        "w",
        encoding="utf-8",
    ) as arquivo:
        json.dump(
            escalas,
            arquivo,
            ensure_ascii=False,
            indent=2,
        )


# ============================================================
# EXCEL
# ============================================================

def salvar_xlsx(
    data_semana,
    escala1,
    escala2,
):
    arquivo = caminho_xlsx(data_semana)

    wb = Workbook()
    ws = wb.active
    ws.title = data_semana.strftime("%d-%m-%Y")

    AZUL_ESCURO = "0B5A93"
    AZUL_QUARTA = "9DBBE8"
    VERMELHO = "FF0000"
    CINZA = "BFBFBF"
    BRANCO = "FFFFFF"
    PRETO = "000000"

    borda_fina = Side(
        style="thin",
        color=PRETO,
    )

    borda = Border(
        left=borda_fina,
        right=borda_fina,
        top=borda_fina,
        bottom=borda_fina,
    )

    alinhamento = Alignment(
        horizontal="center",
        vertical="center",
    )

    fonte_branca = Font(
        name="Arial",
        size=11,
        color=BRANCO,
    )

    fonte_branca_negrito = Font(
        name="Arial",
        size=11,
        bold=True,
        color=BRANCO,
    )

    fonte_normal = Font(
        name="Arial",
        size=11,
        color=PRETO,
    )

    ws.column_dimensions["A"].width = 17
    ws.column_dimensions["B"].width = 32
    ws.column_dimensions["C"].width = 32
    ws.column_dimensions["D"].width = 32

    ws.merge_cells("B1:D1")

    titulo = ws["B1"]
    titulo.value = (
        "TABELA DE TAREFAS - "
        + data_semana.strftime("%d/%m/%Y")
    )
    titulo.font = fonte_branca_negrito
    titulo.alignment = alinhamento

    for coluna in range(2, 5):
        celula = ws.cell(row=1, column=coluna)
        celula.fill = PatternFill(
            fill_type="solid",
            fgColor=AZUL_ESCURO,
        )
        celula.border = borda

    cabecalhos = [
        "",
        "DOMINGO/SEG/TERÇA",
        "QUARTA",
        "QUINTA/SEXTA/SÁB",
    ]

    for coluna, texto in enumerate(
        cabecalhos,
        start=1,
    ):
        celula = ws.cell(
            row=2,
            column=coluna,
        )
        celula.value = texto
        celula.alignment = alinhamento
        celula.border = borda

        if coluna > 1:
            celula.fill = PatternFill(
                fill_type="solid",
                fgColor=AZUL_ESCURO,
            )
            celula.font = fonte_branca_negrito

    linha = 3

    for pessoa in PESSOAS:
        tarefa1 = escala1[pessoa]
        tarefa2 = escala2[pessoa]

        nome = ws.cell(
            row=linha,
            column=1,
        )
        nome.value = pessoa
        nome.fill = PatternFill(
            fill_type="solid",
            fgColor=AZUL_ESCURO,
        )
        nome.font = fonte_branca
        nome.alignment = alinhamento
        nome.border = borda

        c1 = ws.cell(row=linha, column=2)

        if tarefa1 == "FOLGA":
            c1.value = ""
            c1.fill = PatternFill(
                fill_type="solid",
                fgColor=VERMELHO,
            )
        elif tarefa1 == "AUSENTE":
            c1.value = "AUSENTE"
            c1.fill = PatternFill(
                fill_type="solid",
                fgColor=CINZA,
            )
        else:
            c1.value = tarefa1
            c1.fill = PatternFill(
                fill_type="solid",
                fgColor=BRANCO,
            )

        c1.font = fonte_normal
        c1.alignment = alinhamento
        c1.border = borda

        c2 = ws.cell(row=linha, column=3)
        c2.value = ""
        c2.fill = PatternFill(
            fill_type="solid",
            fgColor=AZUL_QUARTA,
        )
        c2.border = borda

        c3 = ws.cell(row=linha, column=4)

        if tarefa2 == "FOLGA":
            c3.value = ""
            c3.fill = PatternFill(
                fill_type="solid",
                fgColor=VERMELHO,
            )
        elif tarefa2 == "AUSENTE":
            c3.value = "AUSENTE"
            c3.fill = PatternFill(
                fill_type="solid",
                fgColor=CINZA,
            )
        else:
            c3.value = tarefa2
            c3.fill = PatternFill(
                fill_type="solid",
                fgColor=BRANCO,
            )

        c3.font = fonte_normal
        c3.alignment = alinhamento
        c3.border = borda

        ws.row_dimensions[linha].height = 22
        linha += 1

    ws.sheet_view.showGridLines = False
    wb.save(arquivo)

    return arquivo


# ============================================================
# GIT ADD / COMMIT / PUSH
# ============================================================

def executar_git(*args):

    resultado = subprocess.run(
        [GIT_EXECUTAVEL, *args],
        cwd=PASTA_SCRIPT,
        text=True,
        capture_output=True
    )

    if resultado.returncode != 0:

        raise RuntimeError(
            resultado.stderr.strip()
            or resultado.stdout.strip()
            or "Erro ao executar Git."
        )

    return resultado.stdout.strip()


def sincronizar_github():
    # Atualiza a pasta local antes de gerar uma nova escala.
    # --autostash permite o rebase mesmo se houver alterações locais
    # em arquivos já rastreados pelo Git.
    executar_git(
        "rev-parse",
        "--is-inside-work-tree",
    )

    print("Sincronizando com o GitHub...")

    executar_git(
        "pull",
        "--rebase",
        "--autostash",
        GIT_REMOTE,
        GIT_BRANCH,
    )

    print("Git pull --rebase concluído.")


def publicar_github(data_semana):
    # Confere se estamos dentro de um repositório
    executar_git("rev-parse", "--is-inside-work-tree")

    # Adiciona somente os arquivos relevantes do projeto
    arquivos = [
        "historico_limpeza.csv",
        "escalas.json",
        "index.html",
        "style.css",
        "script.js",
        os.path.basename(__file__),
    ]

    xlsx_relativo = os.path.basename(
        caminho_xlsx(data_semana)
    )
    arquivos.append(xlsx_relativo)

    executar_git("add", *arquivos)

    # Verifica se existe alteração staged
    diff = subprocess.run(
        [
            GIT_EXECUTAVEL,
            "diff",
            "--cached",
            "--quiet"
        ],
        cwd=PASTA_SCRIPT,
    )

    if diff.returncode == 0:
        print("Não há alterações novas para commit.")
        return

    mensagem = (
        "Atualiza escala "
        + data_semana.strftime("%d/%m/%Y")
    )

    executar_git(
        "commit",
        "-m",
        mensagem,
    )

    if FAZER_PUSH_AUTOMATICO:
        executar_git(
            "push",
            GIT_REMOTE,
            GIT_BRANCH,
        )

        print("Git push concluído com sucesso.")


# ============================================================
# TERMINAL
# ============================================================

def mostrar_escala(
    data_semana,
    escala1,
    escala2,
    folgas_obrigatorias,
):
    print()
    print("=" * 100)
    print(
        "TABELA DE TAREFAS - "
        + data_semana.strftime("%d/%m/%Y")
    )
    print("=" * 100)

    df = pd.DataFrame(
        {
            "DOM/SEG/TER": [
                escala1[pessoa]
                for pessoa in PESSOAS
            ],
            "QUI/SEX/SÁB": [
                escala2[pessoa]
                for pessoa in PESSOAS
            ],
        },
        index=PESSOAS,
    )

    print(df.to_string())

    if folgas_obrigatorias:
        print()
        print(
            "Folga obrigatória nesta semana: "
            + ", ".join(folgas_obrigatorias)
        )


def ler_ausentes():
    print()
    print(
        "Digite as pessoas que NÃO participarão "
        "da escala nesta semana."
    )
    print(
        "Separe os nomes por vírgula. "
        "Se todas estiverem presentes, pressione Enter."
    )

    texto = input("Ausentes: ").strip()

    if not texto:
        return []

    nomes_digitados = [
        nome.strip().upper()
        for nome in texto.split(",")
    ]

    mapa = {
        pessoa.upper(): pessoa
        for pessoa in PESSOAS
    }

    ausentes = []

    for nome in nomes_digitados:
        if nome not in mapa:
            raise ValueError(
                f"Nome inválido: {nome}. "
                f"Use um destes: {', '.join(PESSOAS)}"
            )

        pessoa_real = mapa[nome]

        if pessoa_real not in ausentes:
            ausentes.append(pessoa_real)

    return ausentes


# ============================================================
# EXECUÇÃO
# ============================================================

def main():
    print()
    print("GERADOR DE ESCALA DE LIMPEZA")
    print("=" * 50)

    data_texto = input(
        "Digite o domingo da nova escala (DD/MM/AAAA): "
    ).strip()

    data_semana = datetime.strptime(
        data_texto,
        "%d/%m/%Y",
    )

    if data_semana.weekday() != 6:
        raise ValueError(
            "A data informada não é um domingo."
        )

    ausentes = ler_ausentes()

    # Antes de ler o histórico e gerar a nova escala,
    # traz para a máquina qualquer alteração que esteja no GitHub.
    if FAZER_PUSH_AUTOMATICO:
        print()
        sincronizar_github()

    (
        escala1,
        escala2,
        historico,
        folgas_obrigatorias,
    ) = gerar_semana(
        data_semana,
        ausentes,
    )

    mostrar_escala(
        data_semana,
        escala1,
        escala2,
        folgas_obrigatorias,
    )

    print()
    resposta = input(
        "Deseja salvar e publicar essa escala? (s/n): "
    ).strip().lower()

    if resposta != "s":
        print("Escala não salva.")
        return

    salvar_semana_historico(
        historico,
        data_semana,
        escala1,
        escala2,
    )

    arquivo_xlsx = salvar_xlsx(
        data_semana,
        escala1,
        escala2,
    )

    atualizar_json_site(
        data_semana,
        escala1,
        escala2,
    )

    print()
    print("Arquivos locais atualizados:")
    print(f"- CSV:  {ARQUIVO_HISTORICO}")
    print(f"- JSON: {ARQUIVO_JSON}")
    print(f"- XLSX: {arquivo_xlsx}")

    if FAZER_PUSH_AUTOMATICO:
        print()
        print("Publicando no GitHub...")
        publicar_github(data_semana)

    print()
    print("Concluído.")


if __name__ == "__main__":
    try:
        main()

    except (
        ValueError,
        RuntimeError,
        FileNotFoundError,
        subprocess.SubprocessError,
    ) as erro:
        print()
        print("ERRO:")
        print(erro)
        sys.exit(1)
