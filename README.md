# CELL AGENT Mobile · v0.1.5

App mobile oficial **React Native + Expo** para o CELL SYSTEM, com interface fiel: preto, branco, cinzentos claros, botões em formato pill, cartões arredondados e navegação inferior flutuante.

---

## 🚀 Como Obter o APK Android

O projeto inclui integração de CI/CD via **GitHub Actions** que compila automaticamente o APK standalone sem necessidade de subscrições externas ou ambiente Android local:

1. **GitHub Releases:** Vá à aba **Releases** do repositório para descarregar diretamente o `cell-agent-mobile-v0.1.5.apk`.
2. **GitHub Actions Artifacts:** Em qualquer execução da pipeline **Build Android APK**, o ficheiro APK está disponível para download na secção de Artifacts.
3. **Instalação:**
   - Descarregue o APK diretamente no seu telemóvel Android.
   - Abra o ficheiro e confirme a instalação (ative "Permitir desta fonte" se solicitado pelo Android).
   - Abra o **CELL AGENT** e inicie sessão!

---

## ⚡ Integração Direta com o CELL SYSTEM

O app liga-se diretamente aos serviços existentes do CELL:
- **Supabase Auth & Database:**
  - Login e autenticação direta via Supabase Auth (`/auth/v1/token?grant_type=password`).
  - Sincronização em tempo real de Workspaces (`cells_workspaces`) e Workflows (`cells_workflows`).
- **Cloudflare Pages Backend (`https://cell-griot.pages.dev`):**
  - Execução e estado de Agentes (`/api/agents/runs`).
  - Conectores e credenciais (`/api/credentials`).
  - Skills e Catálogo (`/api/skills`).
  - Fila de Jobs em background (`/api/jobs`).
- **Modo Offline-First:**
  - Capturas de câmara, notas e ficheiros gravadas com persistência local segura via `expo-secure-store`.
  - Histórico de mensagens local persistente enquanto offline.

---

## 📱 Módulos da Aplicação

- **Chat:** Lista de agentes ativos, criação de novos agentes com botão `+`, chat interativo em tempo real com indicador de status e histórico.
- **Capture:** Biblioteca de capturas locais e remotas; suporte para foto, gravação de vídeo, galeria de imagens, documentos e notas de texto.
- **Conectores:** Gestão de conexões nas categorias Conectores, Plugins, MCP, Skills e Cells.
- **Atividade:** Monitorização em tempo real de tarefas (Todas, Ativas e Concluídas).
- **Perfil:** Gestão de sessão, status de sincronização com Supabase/Cloudflare, notificações e logout seguro.

---

## 🛠️ Executar Localmente (Desenvolvimento)

```bash
npm install
npx expo start
```

Pode testar no Expo Go ou iniciar uma build de desenvolvimento Android:
```bash
npx expo run:android
```

---

## 🔒 Variáveis de Ambiente

As variáveis necessárias já possuem fallbacks de produção definidos em `src/services/gateway.ts`, mas podem ser configuradas via `.env`:

```ini
EXPO_PUBLIC_CELL_API_URL=https://cell-griot.pages.dev
EXPO_PUBLIC_SUPABASE_URL=https://oxulnwbwpfxwjbvxlrga.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_aEBNlthmZizezIeYKodSnw_0ndTYG42
```
