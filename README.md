# 🔮 Chute do Vidente

> Bolão da Copa do Mundo 2026 com toque místico — crave seus palpites, acumule cristais e dispute o ranking com seus amigos.

**[🌐 Acessar o app](https://bolao-copa-samuel-lourencos-projects.vercel.app/)**

---

## 📖 Sobre o projeto

**Chute do Vidente** é uma plataforma full-stack de bolão para a Copa do Mundo 2026. Os usuários cravam palpites para os jogos do torneio, acumulam pontos com base na precisão das previsões, e competem em um ranking geral ou em grupos privados criados com amigos.

O projeto carrega uma identidade visual e narrativa própria: **Madame Placar**, a "vidente de plantão" do app, guia a experiência com frases místicas, enquanto pontos reais são apresentados como **cristais** dentro de um sistema de progressão por níveis.

## ✨ Funcionalidades

- **Autenticação completa** — registro, login (JWT) e recuperação de senha por e-mail
- **Palpites em tempo real** — placares validados, com bloqueio automático 5 minutos antes do início de cada jogo
- **Pontuação automatizada** — processamento periódico dos resultados oficiais via integração com a football-data.org, com cálculo de pontos por placar exato, resultado correto ou erro
- **Ranking geral e por grupo** — pódio dos melhores "videntes" do bolão
- **Grupos privados** — crie um grupo, convide amigos por código e acompanhe um ranking exclusivo entre vocês
- **Gamificação** — cristais, níveis e taxa de "premonição" (percentual de acerto) calculados a partir do desempenho real do usuário
- **Histórico de palpites** — acompanhe seus chutes e resultados na página de perfil

## 🛠️ Stack técnica

**Frontend**

- [Next.js](https://nextjs.org/) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) v4
- Deploy: [Vercel](https://vercel.com/)

**Backend**

- [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- Autenticação via JWT + bcrypt
- Rate limiting nas rotas sensíveis (autenticação, palpites, grupos, recuperação de senha)
- Deploy: [Render](https://render.com/)

**Banco de dados**

- [Turso](https://turso.tech/) (libSQL distribuído)

**Integrações**

- [football-data.org](https://www.football-data.org/) — dados oficiais dos jogos da Copa
- [Resend](https://resend.com/) — envio de e-mails transacionais (recuperação de senha)
- [cron-job.org](https://cron-job.org/) — agendamento externo do processamento de jogos finalizados

## 🗂️ Estrutura do repositório

```
.
├── backend/          # API REST (Express)
│   ├── server.js     # Rotas e middlewares
│   ├── database.js   # Schema e conexão com o Turso
│   └── email.js      # Cliente de envio de e-mails (Resend)
└── frontend/         # Aplicação Next.js
    └── app/
        ├── components/   # Componentes compartilhados (Header, Sidebar, Madame Placar...)
        ├── jogos/        # Tela principal de palpites
        ├── resultados/   # Jogos encerrados
        ├── ranking/      # Ranking geral
        ├── grupos/       # Grupos privados e ranking por grupo
        └── perfil/       # Estatísticas e histórico do usuário
```

## 🚀 Rodando localmente

### Pré-requisitos

- Node.js 18+
- Uma conta [Turso](https://turso.tech/) com banco de dados criado
- Chave de API do [football-data.org](https://www.football-data.org/)
- (Opcional) Chave de API do [Resend](https://resend.com/) para testar e-mails reais

### Backend

```bash
cd backend
npm install
cp .env.example .env   # configure suas variáveis de ambiente
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`.

### Variáveis de ambiente principais

| Variável             | Descrição                                                                     |
| -------------------- | ----------------------------------------------------------------------------- |
| `JWT_SECRET`         | Segredo para assinatura dos tokens de autenticação                            |
| `TURSO_DATABASE_URL` | URL de conexão do banco Turso                                                 |
| `TURSO_AUTH_TOKEN`   | Token de autenticação do Turso                                                |
| `FOOTBALL_API_KEY`   | Chave de acesso à football-data.org                                           |
| `RESEND_API_KEY`     | Chave de API do Resend (envio de e-mails)                                     |
| `ADMIN_SECRET`       | Segredo para autenticar chamadas administrativas (ex: processamento de jogos) |
| `FRONTEND_URL`       | URL do frontend, usada na geração de links de e-mail                          |

## 🔮 Sobre o nome

"Chute do Vidente" brinca com a ambiguidade da palavra **chute** — tanto o gesto do futebol quanto o palpite informal — guiado pela figura cômica e mística da Madame Placar, sua "vidente de plantão".

## 👤 Autor

**Samuel Lourenço**
Estudante de Engenharia de Software (UMJ) | Maceió, AL — Brasil

---

<p align="center">Feito com 🔮 e muita fé na Seleção.</p>
