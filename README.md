# CELL AGENT Mobile · v0.3.0

Cliente React Native + Expo do CELL SYSTEM. Esta versão altera apenas a app móvel. Usa os contratos já existentes de Supabase Auth/REST e da API Cell Griot; não contém backend, migrações, alterações ao site ou deploys desses serviços.

## Experiência da app

- Abre no agente central de um workflow. A estrela na lista define o agente principal deste utilizador e workspace, apenas no dispositivo.
- Mostra uma conversa por workflow, com mensagens e execuções identificadas pelos IDs reais do serviço. Nós especialistas são capacidades do central, não conversas independentes.
- Apresenta fila, execução, pausa, aprovação, conclusão, falha e cancelamento. A app usa os controlos e o tick já existentes; a continuidade sem a app aberta depende do scheduler configurado no serviço.
- Permite aprovar a operação exata, recusar/cancelar, pausar e retomar. Uma aprovação alterada é recusada antes de submeter o pedido.
- Lista os Cells e Skills realmente presentes no workflow e as credenciais disponíveis no cofre. A autorização é imposta pelo servidor. A presença de uma credencial não é anunciada como prova de ligação ao serviço.
- As configurações de modelo, credenciais e permissões são guardadas apenas por ação explícita do utilizador. Pertencem ao agente do workflow e são partilhadas entre os clientes que o utilizam.
- Mostra ficheiros gerados no chat e em Atividade. Pede uma ligação assinada ao serviço quando o utilizador abre um ficheiro; não guarda ligações assinadas na cache.

## Sessão e dados locais

A sessão inclui renovação de tokens e coordena renovações concorrentes. Em Android/iOS os tokens ficam no SecureStore; no preview web ficam em sessionStorage. A cache usa SQLite no dispositivo e IndexedDB no preview, com chaves separadas por utilizador, workspace e agente.

Rascunhos e anexos pendentes sobrevivem à navegação. Um envio falhado conserva a chave de idempotência, permitindo repetir o mesmo pedido sem criar outra missão. A app não repete automaticamente pedidos cujo resultado de rede seja desconhecido.

Capture é uma biblioteca local. Os ficheiros são copiados para a área da app, sem os marcar como sincronizados. Sair limpa os dados e capturas locais desta conta. A versão anterior exige novo login porque não guardava refresh tokens; a app não importa caches antigas sem identidade verificável.

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

A workflow de APK continua separada. Publicar uma release ou produzir um APK de atualização exige a chave de assinatura correspondente à versão instalada.
