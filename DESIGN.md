# CELL AGENT Mobile — Design v0.1.1

## Estrutura fechada

**Bottom navigation:** Chat · Capture · Conectores · Atividade · Perfil.

**Chat** mostra agentes, não uma lista global de conversas. Cada agente tem chat próprio e botão `+` cria um agente. Em chat, barra inferior de escrita com pill SVG+nome do agente, não Chat/Quick.

**Capture** igual ao padrão visual enviado pelo utilizador: título grande, kicker cinzento, card central alto, ícone câmara em círculo preto, recentes, bottom sheet de capturar em grade de duas colunas.

**Conectores** lista Conectores · Plugins · MCP · Skills · Cells. **Atividade** centraliza runs, aprovações e erros. **Perfil** contém Definições e notificações.

## Tokens de design

| Papel | Valor |
|---|---|
| Background | `#FFFFFF` |
| Ink | `#070707` |
| Surface | `#F7F7F7` |
| Surface secondary | `#F2F2F2` |
| Border | `#E2E2E2` |
| Muted | `#777777` |
| Card radius | `28pt` |
| Composer radius | `30pt` |
| Bottom sheet radius | `32pt` |
| Bottom nav height | `80pt` |
| Bottom nav | flutuante, com contorno subtil e sombra suave |
| Títulos | `36pt`, bold, letterSpacing -1.25 |
| Alvos de toque | >=44pt |

Referência: capturas fornecidas pelo utilizador em 2026-10-19. O logótipo central padrão do CELL AGENT foi atualizado para o símbolo aprovado: círculo preto maior e dois olhos brancos em formato cápsula. Agentes com identidades individuais poderão usar outros SVGs quando o backend os fornecer.

**Importante:** o objetivo é correspondência visual muito próxima, não se garante precisão pixel a pixel sem medir em dispositivos Android/iOS reais e comparar screenshot a screenshot.


## Logo oficial v0.1.5

Usar exclusivamente a imagem original do utilizador `src/assets/cell-agent-logo-original.jpg` sem reinterpretação. Avatares utilizam zoom 2.15 de renderização (não edição de pixels). PNGs de sistema operativo são derivados da imagem original mediante crop/resize, nunca por redesenho.


### Navegação inferior v0.1.5
Somente os glifos dos cinco separadores mudam: paths SVG próprios reproduzem o balão, a câmara, a pasta, os deslizadores e a casa da captura. Mantêm-se todas as dimensões, fundos, tipografia, transparências e bordas da versão anterior.
