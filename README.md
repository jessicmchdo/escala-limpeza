# Escala de Limpeza — GitHub Pages

Projeto estático para consultar a escala semanal de limpeza.

## Estrutura

- `index.html` — página do site.
- `style.css` — visual da tabela.
- `script.js` — lê `escalas.json` e mostra a semana escolhida.
- `escalas.json` — banco de dados simples usado pelo site.
- `gerar_escala.py` — gera a escala, atualiza CSV/JSON/XLSX e executa `git add`, `git commit` e `git push`.
- `historico_limpeza.csv` — criado/atualizado pelo Python.
- `escala_limpeza_DD_MM_AAAA.xlsx` — planilha gerada a cada semana.

## 1. Instale as dependências

No terminal:

```powershell
pip install pandas openpyxl
```

Também é necessário ter o Git instalado:

```powershell
git --version
```

## 2. Crie o repositório no GitHub

Crie um repositório, por exemplo:

`escala-limpeza`

Depois, dentro desta pasta:

```powershell
git init
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/escala-limpeza.git
git add .
git commit -m "Configura site da escala"
git push -u origin main
```

Se você usa SSH, pode usar a URL SSH do repositório no lugar da HTTPS.

## 3. Configure o acesso ao GitHub

O script NÃO guarda senha ou token.

Antes de depender do push automático, confirme que isto funciona manualmente:

```powershell
git push
```

No Windows, o Git Credential Manager normalmente abre a autenticação do GitHub e guarda a credencial com segurança.

## 4. Ative o GitHub Pages

No repositório:

1. `Settings`
2. `Pages`
3. `Build and deployment`
4. Source: `Deploy from a branch`
5. Branch: `main`
6. Folder: `/ (root)`
7. Salve.

Depois o site ficará em um endereço parecido com:

`https://SEU_USUARIO.github.io/escala-limpeza/`

## 5. Uso semanal

Execute:

```powershell
python gerar_escala.py
```

O programa perguntará:

- data do domingo;
- pessoas ausentes;
- se você deseja salvar e publicar.

Ao confirmar, ele:

1. atualiza `historico_limpeza.csv`;
2. atualiza `escalas.json`;
3. gera a planilha `.xlsx`;
4. executa `git add`;
5. executa `git commit`;
6. executa `git push`.

O GitHub Pages atualizará o site após o push.

## Observação importante

O push automático pressupõe que o repositório local já esteja configurado e que `git push origin main` funcione sem você precisar colocar senha diretamente no script.
