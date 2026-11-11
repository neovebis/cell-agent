/* Public website catalog snapshot. Refresh with scripts/sync-cell-catalog.cjs. */
import type { CellCatalogEntry } from "../types";
export const CELL_CATALOG_SOURCE = {
  "source": "https://cell-griot.pages.dev/assets/public-navigation-CiSXUAs7.js",
  "sha256": "3420bc9cbb9ef9e0d3955979022e9bb0fa7d5541a8443c82434cb40cf6536ce3",
  "synchronizedAt": "2026-11-11T18:23:07.146Z",
  "visibleCount": 36
};
export const CELL_CATALOG: readonly CellCatalogEntry[] = [
  {
    "id": "artcraft_wordcraft",
    "canonicalType": "artcraft_wordcraft",
    "label": "Documento",
    "category": "compute",
    "badge": "DOC",
    "accentColor": "#356f5e",
    "description": "Inspeciona, converte ou edita documentos com o motor WordCraft. Requer executor nativo configurado; até 1 MiB.",
    "icon": "lucide:file-text"
  },
  {
    "id": "artcraft_gridcraft",
    "canonicalType": "artcraft_gridcraft",
    "label": "Folha de cálculo",
    "category": "compute",
    "badge": "GRID",
    "accentColor": "#356f5e",
    "description": "Inspeciona, converte ou edita documentos com o motor GridCraft. Requer executor nativo configurado; até 1 MiB.",
    "icon": "lucide:table"
  },
  {
    "id": "artcraft_deckcraft",
    "canonicalType": "artcraft_deckcraft",
    "label": "Apresentação",
    "category": "compute",
    "badge": "DECK",
    "accentColor": "#356f5e",
    "description": "Inspeciona, converte ou edita documentos com o motor DeckCraft. Requer executor nativo configurado; até 1 MiB.",
    "icon": "lucide:layers"
  },
  {
    "id": "artcraft_cadcraft",
    "canonicalType": "artcraft_cadcraft",
    "label": "Desenho técnico",
    "category": "compute",
    "badge": "CAD",
    "accentColor": "#356f5e",
    "description": "Cria geometria métrica e cotas com o motor CADCraft. Reabre DXF e confere unidades/medidas; DXF, PNG, SVG ou PDF. Requer executor nativo.",
    "icon": "lucide:ruler"
  },
  {
    "id": "artcraft_figcraft",
    "canonicalType": "artcraft_figcraft",
    "label": "Componentes",
    "category": "compute",
    "badge": "UI",
    "accentColor": "#356f5e",
    "description": "Cria componentes, instâncias e layout automático com o motor FigCraft. Projeto nativo, PNG, SVG ou PDF; requer executor nativo.",
    "icon": "lucide:component"
  },
  {
    "id": "artcraft_designcraft",
    "canonicalType": "artcraft_designcraft",
    "label": "Publicação",
    "category": "compute",
    "badge": "LAY",
    "accentColor": "#356f5e",
    "description": "Compõe texto encadeado entre páginas com o motor DesignCraft. Projeto nativo, PDF ou PNG; bloqueia exportações com texto excedente. Requer executor nativo.",
    "icon": "lucide:panels-top-left"
  },
  {
    "id": "artcraft_filmcraft",
    "canonicalType": "artcraft_filmcraft",
    "label": "Vídeo",
    "category": "compute",
    "badge": "FILM",
    "accentColor": "#356f5e",
    "description": "Combina PNG com áudio WAV opcional com o motor FilmCraft. Preview PNG ou MP4 H.264/AAC; até 512 px, 120 frames e 1 MiB; requer executor nativo.",
    "icon": "lucide:film"
  },
  {
    "id": "artcraft_soundcraft",
    "canonicalType": "artcraft_soundcraft",
    "label": "Áudio",
    "category": "compute",
    "badge": "SND",
    "accentColor": "#356f5e",
    "description": "Inspeciona e processa WAV PCM16 pelo motor SoundCraft. Volume, pan, mute, undo/redo e bounce estéreo até 5 s e 1 MiB; requer executor nativo.",
    "icon": "lucide:audio-lines"
  },
  {
    "id": "artcraft_effectcraft",
    "canonicalType": "artcraft_effectcraft",
    "label": "Composição",
    "category": "compute",
    "badge": "FX",
    "accentColor": "#356f5e",
    "description": "Cria composições e keyframes pelo motor EffectCraft. Receita fechada de camadas sólidas; projeto nativo ou frame PNG. Requer executor nativo.",
    "icon": "lucide:layers"
  },
  {
    "id": "artcraft_lightcraft",
    "canonicalType": "artcraft_lightcraft",
    "label": "Revelação",
    "category": "compute",
    "badge": "RAW",
    "accentColor": "#356f5e",
    "description": "Revela PNG/DNG Bayer16 suportado com o motor LightCraft. Ajustes de luz/cor e recorte; PNG sRGB até 1 MiB; requer executor nativo.",
    "icon": "lucide:image"
  },
  {
    "id": "artcraft_vectorcraft",
    "canonicalType": "artcraft_vectorcraft",
    "label": "Vetor",
    "category": "compute",
    "badge": "VEC",
    "accentColor": "#356f5e",
    "description": "Inspeciona, edita e exporta SVG com o motor VectorCraft. SVG/PDF e preview PNG; requer executor nativo; até 1 MiB.",
    "icon": "lucide:pen-tool"
  },
  {
    "id": "artcraft_photocraft",
    "canonicalType": "artcraft_photocraft",
    "label": "Imagem",
    "category": "compute",
    "badge": "IMG",
    "accentColor": "#356f5e",
    "description": "Inspeciona, transforma e exporta PNG/PSD com o motor PhotoCraft. Requer executor nativo; até 1 MiB e 16 MP.",
    "icon": "lucide:image"
  },
  {
    "id": "artcraft_pdf",
    "canonicalType": "artcraft_pdf",
    "label": "PDF",
    "category": "compute",
    "badge": "PDF",
    "accentColor": "#356f5e",
    "description": "Inspeciona, pesquisa, extrai texto/páginas, organiza e pré-visualiza PDFs com o motor PdfCraft. Cópias verificadas por reabertura; até 1 MiB.",
    "icon": "lucide:file-text"
  },
  {
    "id": "source",
    "canonicalType": "source",
    "label": "Fonte",
    "category": "source",
    "badge": "01",
    "accentColor": "#4ade80",
    "description": "Origem de dados, eventos do utilizador, ficheiros ou webhooks.",
    "icon": "cell:fonte"
  },
  {
    "id": "processor",
    "canonicalType": "processor",
    "label": "Processador",
    "category": "compute",
    "badge": "02",
    "accentColor": "#60a5fa",
    "description": "Transforma, higieniza, mapeia ou interpola dados com lógica e expressões.",
    "icon": "cell:processador"
  },
  {
    "id": "agent",
    "canonicalType": "agent",
    "label": "Agente IA",
    "category": "intelligence",
    "badge": "03",
    "accentColor": "#c084fc",
    "description": "Entidade autónoma de decisão, planeamento e verificação baseada em objetivos.",
    "icon": "cell:agente"
  },
  {
    "id": "model",
    "canonicalType": "model",
    "label": "Modelo IA",
    "category": "intelligence",
    "badge": "04",
    "accentColor": "#facc15",
    "description": "Endpoint e adapter para modelos de inteligência artificial (LLM, Visão, Embeddings).",
    "icon": "model:openai"
  },
  {
    "id": "action",
    "canonicalType": "action",
    "label": "Ação",
    "category": "execution",
    "badge": "05",
    "accentColor": "#fb923c",
    "description": "Executa operações externas como chamadas HTTP, envio de eventos ou gravação de ficheiros.",
    "icon": "cell:acao"
  },
  {
    "id": "executor",
    "canonicalType": "executor",
    "label": "Executor",
    "category": "execution",
    "badge": "06",
    "accentColor": "#f87171",
    "description": "Ambiente e sandbox de execução de código isolado (JS, Python, Shell).",
    "icon": "cell:executor"
  },
  {
    "id": "memory",
    "canonicalType": "memory",
    "label": "Memória",
    "category": "memory",
    "badge": "07",
    "accentColor": "#a8a29e",
    "description": "Armazenamento contextual durável, memória episódica e pacote de experiências.",
    "icon": "cell:memoria"
  },
  {
    "id": "router",
    "canonicalType": "router",
    "label": "Roteador",
    "category": "compute",
    "badge": "08",
    "accentColor": "#e2e8f0",
    "description": "Decisão de fluxo condicional, filtragem semântica e bifurcação de caminhos.",
    "icon": "cell:roteador"
  },
  {
    "id": "switch",
    "canonicalType": "router",
    "label": "Switch / Múltiplas Rotas",
    "category": "compute",
    "badge": "SW",
    "accentColor": "#f43f5e",
    "description": "Roteador multi-condicional avançado com N saídas dinâmicas, combinadores AND/OR e saída Fallback.",
    "icon": "cell:roteador"
  },
  {
    "id": "merger",
    "canonicalType": "merger",
    "label": "Unificador",
    "category": "compute",
    "badge": "09",
    "accentColor": "#f59e0b",
    "description": "Barreira de sincronização (fan-in): aguarda a conclusão de múltiplos ramos antes de prosseguir.",
    "icon": "cell:unificador"
  },
  {
    "id": "sink",
    "canonicalType": "sink",
    "label": "Destino",
    "category": "output",
    "badge": "10",
    "accentColor": "#38bdf8",
    "description": "Ponto terminal da computação: gera relatórios, disponibiliza downloads ou emite resultados.",
    "icon": "cell:destino"
  },
  {
    "id": "container",
    "canonicalType": "container",
    "label": "Contentor",
    "category": "container",
    "badge": "11",
    "accentColor": "#818cf8",
    "description": "Encapsulamento de subgrafo: agrupa um conjunto de células internas num único nó executável.",
    "icon": "cell:contentor"
  },
  {
    "id": "skill",
    "canonicalType": "skill",
    "label": "Habilidade",
    "category": "skill",
    "badge": "12",
    "accentColor": "#2dd4bf",
    "description": "Capacidade operacional especializada com procedimentos, ferramentas e verificação.",
    "icon": "cell:habilidade"
  },
  {
    "id": "iterator",
    "canonicalType": "iterator",
    "label": "Iterador (Loop)",
    "category": "compute",
    "badge": "13",
    "accentColor": "#ec4899",
    "description": "Itera sobre listas e arrays de dados, executando o fluxo downstream para cada item.",
    "icon": "lucide:split"
  },
  {
    "id": "call_workflow",
    "canonicalType": "call_workflow",
    "label": "Sub-Workflow",
    "category": "container",
    "badge": "14",
    "accentColor": "#a855f7",
    "description": "Invoca outro fluxo guardado no Supabase, passando-lhe os dados e recebendo o resultado final.",
    "icon": "lucide:workflow"
  },
  {
    "id": "subworkflow",
    "canonicalType": "call_workflow",
    "label": "Sub-Workflow",
    "category": "container",
    "badge": "14",
    "accentColor": "#a855f7",
    "description": "Alias para invocação modular de outros fluxos.",
    "icon": "lucide:workflow"
  },
  {
    "id": "stripe",
    "canonicalType": "stripe",
    "label": "Stripe",
    "category": "execution",
    "badge": "15",
    "accentColor": "#6366f1",
    "description": "Pagamentos, faturas, clientes e eventos de checkout na plataforma Stripe.",
    "icon": "lucide:credit-card"
  },
  {
    "id": "telegram",
    "canonicalType": "telegram",
    "label": "Telegram Bot",
    "category": "execution",
    "badge": "16",
    "accentColor": "#0ea5e9",
    "description": "Envia mensagens formatadas, notificações e alertas automáticos via Telegram Bot API.",
    "icon": "lucide:send"
  },
  {
    "id": "google_sheets",
    "canonicalType": "google_sheets",
    "label": "Google Sheets",
    "category": "execution",
    "badge": "17",
    "accentColor": "#10b981",
    "description": "Insere, lê e atualiza linhas e dados estruturados em folhas de cálculo do Google Sheets.",
    "icon": "lucide:table"
  },
  {
    "id": "discord",
    "canonicalType": "discord",
    "label": "Discord",
    "category": "execution",
    "badge": "18",
    "accentColor": "#5865f2",
    "description": "Publica mensagens e cartões Rich Embeds diretamente em canais do Discord via Webhook.",
    "icon": "lucide:message-square"
  },
  {
    "id": "slack",
    "canonicalType": "slack",
    "label": "Slack",
    "category": "execution",
    "badge": "19",
    "accentColor": "#4a154b",
    "description": "Publica mensagens, notificações e blocos formatados em canais ou mensagens diretas do Slack.",
    "icon": "lucide:circle-dot"
  },
  {
    "id": "github",
    "canonicalType": "github",
    "label": "GitHub",
    "category": "execution",
    "badge": "20",
    "accentColor": "#24292e",
    "description": "Cria issues, adiciona comentários, dispara workflows do GitHub Actions e consulta repositórios.",
    "icon": "lucide:circle-dot"
  },
  {
    "id": "supabase_db",
    "canonicalType": "supabase_db",
    "label": "Supabase DB",
    "category": "execution",
    "badge": "21",
    "accentColor": "#3ecf8e",
    "description": "Efetua operações nativas de base de dados (Insert, Select, Update, Delete) diretamente no Supabase.",
    "icon": "lucide:circle-dot"
  },
  {
    "id": "trigger",
    "canonicalType": "source",
    "label": "Início",
    "category": "source",
    "badge": "01",
    "accentColor": "#4ade80",
    "description": "Arranca o fluxo quando clicas em Executar.",
    "icon": "cell:fonte"
  },
  {
    "id": "delay",
    "canonicalType": "processor",
    "label": "Espera",
    "category": "compute",
    "badge": "02",
    "accentColor": "#60a5fa",
    "description": "Espera por um prazo ou callback. Na fila, o servidor guarda e retoma a execução.",
    "icon": "cell:processador"
  },
  {
    "id": "branch",
    "canonicalType": "router",
    "label": "Se",
    "category": "compute",
    "badge": "08",
    "accentColor": "#e2e8f0",
    "description": "Divide a ordem conforme a informação recebida.",
    "icon": "cell:roteador"
  },
  {
    "id": "merge",
    "canonicalType": "merger",
    "label": "Juntar",
    "category": "compute",
    "badge": "09",
    "accentColor": "#f59e0b",
    "description": "Espera por todas as ordens ligadas antes de continuar.",
    "icon": "cell:unificador"
  },
  {
    "id": "data",
    "canonicalType": "processor",
    "label": "Dados",
    "category": "compute",
    "badge": "02",
    "accentColor": "#60a5fa",
    "description": "Cria ou mistura informação em JSON.",
    "icon": "cell:processador"
  },
  {
    "id": "text",
    "canonicalType": "processor",
    "label": "Texto",
    "category": "compute",
    "badge": "02",
    "accentColor": "#60a5fa",
    "description": "Monta texto com {{campos}} dos dados.",
    "icon": "cell:processador"
  },
  {
    "id": "random",
    "canonicalType": "source",
    "label": "Aleatório",
    "category": "source",
    "badge": "01",
    "accentColor": "#4ade80",
    "description": "Gera um número aleatório e emite como dados.",
    "icon": "cell:fonte"
  },
  {
    "id": "fileWrite",
    "canonicalType": "action",
    "label": "Ficheiro",
    "category": "execution",
    "badge": "05",
    "accentColor": "#fb923c",
    "description": "Escreve um artefacto a partir da informação.",
    "icon": "cell:acao"
  },
  {
    "id": "fileRead",
    "canonicalType": "source",
    "label": "Ler Ficheiro",
    "category": "source",
    "badge": "01",
    "accentColor": "#4ade80",
    "description": "Lê o conteúdo de um artefacto para dados.",
    "icon": "cell:fonte"
  },
  {
    "id": "command",
    "canonicalType": "action",
    "label": "Comando",
    "category": "execution",
    "badge": "05",
    "accentColor": "#fb923c",
    "description": "Emite um comando estruturado com argumentos.",
    "icon": "cell:acao"
  },
  {
    "id": "runCommand",
    "canonicalType": "executor",
    "label": "Executar",
    "category": "execution",
    "badge": "06",
    "accentColor": "#f87171",
    "description": "Recebe um comando e executa-o no executor disponível.",
    "icon": "cell:executor"
  },
  {
    "id": "http",
    "canonicalType": "action",
    "label": "Pedido HTTP",
    "category": "execution",
    "badge": "05",
    "accentColor": "#fb923c",
    "description": "Pedido HTTP a API REST externa.",
    "icon": "cell:acao"
  },
  {
    "id": "log",
    "canonicalType": "sink",
    "label": "Diário / Log",
    "category": "output",
    "badge": "10",
    "accentColor": "#38bdf8",
    "description": "Regista o que chega pelas portas no console do sistema.",
    "icon": "cell:destino"
  },
  {
    "id": "result",
    "canonicalType": "sink",
    "label": "Resultado",
    "category": "output",
    "badge": "10",
    "accentColor": "#fafafa",
    "description": "Recolhe e resume o que o fluxo produziu.",
    "icon": "cell:destino"
  },
  {
    "id": "python",
    "canonicalType": "python",
    "label": "Python Sandbox",
    "category": "compute",
    "badge": "PY",
    "accentColor": "#fafafa",
    "description": "Execução remota e hermética de scripts Python 3.11 no Google Cloud Run (gVisor).",
    "icon": "lucide:file-code"
  },
  {
    "id": "bash",
    "canonicalType": "bash",
    "label": "Terminal Bash",
    "category": "compute",
    "badge": "SH",
    "accentColor": "#fafafa",
    "description": "Execução de comandos Linux Bash em container gVisor isolado no Cloud Run.",
    "icon": "lucide:terminal"
  }
];
