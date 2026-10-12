# Vida em Ordem — como colocar no ar e instalar

App instalável (PWA) para Android e computador. Seções: **Ciclo** (calendário com previsão de menstruação e período fértil + controle/lembrete do anticoncepcional, com ou sem pausa), **Hábitos** (por dia/semana/fim de semana), **Estudos** (meta diária + Pomodoro), **Treino** (exercícios com repetições e caixinha de feito), **Alimentação** (plano da dieta, água e diário de comida), **Compras** (desejos e necessidades), **Agenda**, **Diário/reflexão** e **Backup**.

Os dados ficam no próprio aparelho (funciona offline) e, a cada alteração, são salvos numa pasta privada do **seu Google Drive**. Abrindo em outro aparelho com a mesma conta, os dados mais novos vêm do Drive.

## Parte 1 — Colocar o app num endereço https (uma vez só)

O app precisa de um endereço `https://` para poder ser instalado. Opções gratuitas, escolha uma:

- **Netlify Drop** (mais fácil): acesse `app.netlify.com/drop` e arraste a pasta `vida-em-ordem` descompactada. Ele devolve um endereço como `https://nome-aleatorio.netlify.app`.
- **GitHub Pages**: crie um repositório, envie os arquivos e ative *Settings → Pages*.
- **Cloudflare Pages**: *Workers & Pages → Create → Pages → Upload assets*.

Para testar só no computador: dentro da pasta, rode `python3 -m http.server 8000` e abra `http://localhost:8000`.

Anote o endereço final: ele é a "origem" usada na Parte 2.

## Parte 2 — Ligar o backup ao Google (uma vez só)

1. Acesse `console.cloud.google.com` e crie um projeto (ex.: "Vida em Ordem").
2. **APIs e serviços → Biblioteca** → ative a **Google Drive API**.
3. **Tela de permissão OAuth** → tipo **Externo** → preencha nome do app e e-mail → em **Usuários de teste**, adicione o seu e-mail (o mesmo da conta Google que vai usar).
4. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**. Em **Origens JavaScript autorizadas**, coloque o endereço da Parte 1 (sem barra no final). Se for testar local, adicione também `http://localhost:8000`.
5. Copie o **ID do cliente** (termina com `.apps.googleusercontent.com`).
6. Abra o app → aba **Backup** → cole o ID → **Salvar** → **Entrar com Google e ativar**.

Alternativa: cole o ID em `config.js` antes de publicar; assim já vem configurado em todos os aparelhos.

O app só pede acesso à **pasta privada dele** no Drive (escopo `drive.appdata`): não enxerga nenhum outro arquivo seu.

## Parte 3 — Instalar

- **Android (Chrome):** abra o endereço → menu ⋮ → **Instalar app** (ou botão "⬇ Instalar" no topo do app).
- **Computador (Chrome/Edge):** abra o endereço → ícone de instalar na barra de endereço (ou botão "⬇ Instalar" no app).

Repita o login do Google em cada aparelho (aba Backup).

## Limites que vale conhecer

- **Login do Google dura cerca de 1 hora.** Depois disso, a primeira alteração fica "pendente" e o topo mostra "☁️ Reconectar"; é só tocar em qualquer botão do app para renovar e o backup sai na hora. Os dados nunca se perdem: ficam no aparelho até o backup acontecer.
- **Conflitos:** vale a última alteração salva. Se usar dois aparelhos ao mesmo tempo, o app pergunta antes de substituir.
- **Avisos (pílula, compromissos):** funcionam com o app aberto ou em segundo plano. Com o app fechado o navegador não garante. Mantenha também um alarme no relógio do celular para a pílula.
- **Previsão do ciclo:** é uma estimativa pela média dos seus registros e **não é método contraceptivo**.
- **Agenda → 📆** baixa um arquivo `.ics` para adicionar o compromisso ao Google Agenda.
- Backup manual: aba Backup → "Baixar backup (.json)" / "Importar".
