# CELL AGENT Mobile · v0.3.2

Cliente React Native + Expo do CELL SYSTEM. Esta versão altera apenas a app móvel. Usa os contratos já existentes de Supabase Auth/REST e da API Cell Griot; não contém backend, migrações, alterações ao site ou deploys desses serviços.

## Experiência da app

- Abre no agente central de um workflow. A preferência de agente principal fica no menu da conversa e é guardada apenas neste dispositivo, por utilizador e workspace.
- O cabeçalho mostra o emote e o nome numa cápsula com altura de 48 px, mantendo o comprimento. Tocar no nome ou na zona direita abre as opções; a zona esquerda regressa à lista.
- Mostra uma conversa por workflow, com mensagens e execuções identificadas pelos IDs reais do serviço. Nós especialistas são capacidades do central, não conversas independentes.
- As respostas regressam às bolhas claras. As entradas, os três pontos e o menu usam animações Reanimated; o emote evita recalcular o contorno estático e suspende a simulação em segundo plano. A resposta do tick é aplicada imediatamente; a consulta de histórico acelera enquanto há trabalho ativo. Aprovações continuam explícitas.
- Permite aprovar a operação exata, recusar/cancelar, pausar e retomar. Uma aprovação alterada é recusada antes de submeter o pedido.
- O catálogo reproduz os 36 Cells visíveis do site, incluindo 13 Artcraft, com os SVG originais e 16 aliases antigos. Carrega também os conectores públicos e privados autorizados no espaço. Cada agente mostra os seus Cells adicionados e autorizados; o catálogo não concede permissões automaticamente.
- As configurações de modelo, credenciais e permissões são guardadas apenas por ação explícita do utilizador. Pertencem ao agente do workflow e são partilhadas entre os clientes que o utilizam.
- Mostra ficheiros gerados no chat e em Atividade. Pede uma ligação assinada ao serviço quando o utilizador abre um ficheiro; não guarda ligações assinadas na cache.

As opções de Tarefas e Capacidades abrem painéis pessoais do agente atual, sem mudar a aba global. O teclado é gerido pelo controlador nativo compatível com o SDK 54, para manter o campo de mensagem visível em Android e iOS.

## Sessão e dados locais

A sessão inclui renovação de tokens e coordena renovações concorrentes. Em Android/iOS os tokens ficam no SecureStore; no preview web ficam em sessionStorage. A cache usa SQLite no dispositivo e IndexedDB no preview, com chaves separadas por utilizador, workspace e agente.

Rascunhos e anexos pendentes sobrevivem à navegação. Um envio falhado conserva a chave de idempotência, permitindo repetir o mesmo pedido sem criar outra missão. A app não repete automaticamente pedidos cujo resultado de rede seja desconhecido.

Capture é uma biblioteca local. Os ficheiros são copiados para a área da app, sem os marcar como sincronizados. Sair limpa os dados e capturas locais desta conta. As versões 0.2.x exigem novo login porque não guardavam refresh tokens; a app não importa caches antigas sem identidade verificável.

## Contratos e limites existentes

O contrato do serviço aceita até quatro ficheiros, 2 MiB por ficheiro e 4 MiB por mensagem; o seletor móvel desta versão envia um anexo por mensagem. Texto/código tem limite de 192 KiB; a mensagem tem limite de 8 KB. Formatos: texto/código, PDF, PNG, JPEG, WebP e GIF, sujeitos também à compatibilidade do modelo. Vídeo, áudio e documentos Office não são enviados como anexos deste endpoint.

Os Cells Artcraft atuam pelas instâncias e fontes já configuradas no workflow. A app não duplica os motores, não instala executáveis no telemóvel e não anuncia as aplicações Artcraft como editores completos. Disponibilidade, operações e limites dependem dos contratos do serviço e dos executores configurados.

O serviço atual não expõe registo push para esta app. A interface informa essa limitação e mantém o acompanhamento em Atividade. Não existem funcionalidades remotas simuladas.

## Desenvolvimento

Recomendado Node 24 LTS. Instalar as dependências com npm ci quando o lockfile está presente; depois:

- npm start — desenvolvimento Expo
- npm run typecheck — verificação de tipos
- npm test — contratos HTTP, sessão, idempotência, isolamento e aprovações
- npm run build:android — exportação do bundle Android, sem publicar
- npm run build:web — preview web em dist, sem publicar

As variáveis públicas estão em .env.example. Apenas URL e chave publicável Supabase pertencem ao cliente. Chaves service-role, segredos do cofre e credenciais de fornecedores nunca devem ser adicionados à app.

O preview web pode estar sujeito às políticas CORS já configuradas no serviço. O cliente nativo não altera essas políticas.

## Validação sem tocar na produção

A workflow Validate CELL AGENT instala e verifica apenas este repositório, exporta bundles Android/web e testa o cliente em desktop e viewport móvel. Os testes UI usam exclusivamente hosts reservados .example interceptados no navegador; bloqueiam qualquer pedido externo inesperado. Não iniciam sessões reais, não executam motores, não gastam créditos de modelos e não modificam dados de produção.

O build UI isolado usa as variáveis de teste e a pasta build/test-web. O bundle de produto usa a configuração normal e fica separado. Evidência e screenshots ficam nos artefactos temporários da execução, não na fonte. Estes testes verificam o cliente e os contratos; não certificam o funcionamento dos executores de produção nem substituem o ensaio num dispositivo Android/iOS.

A v0.3.2 mantém a chave e o armazenamento das versões 0.3.0 e 0.3.1. O código Android aumenta para 8, permitindo atualização sem desinstalar.

A workflow de APK continua separada e produz um APK release assinado, checksum, manifesto e metadados de assinatura nos artefactos, sem publicar releases automaticamente. Exige os GitHub Secrets KEYSTORE_BASE64, KEYSTORE_ALIAS, KEYSTORE_PASSWORD e KEY_PASSWORD; nunca gera uma chave de substituição durante o build. Compara o certificado com o APK v0.2.2 e regista se permite atualização direta. Produzir um APK de atualização exige a chave de assinatura correspondente à versão instalada.
