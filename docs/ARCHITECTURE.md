# Arquitetura

O projeto usa TypeScript de ponta a ponta, React para a interface, Vinext/Vite para a aplicação e Three.js carregado apenas no cliente para WebGL. O endpoint é compatível com Cloudflare Workers e não expõe segredos.

## Percurso dos dados

1. TanStack Query consulta `GET /api/weather`.
2. `createWeatherService` verifica a cache em memória e deduplica pedidos concorrentes.
3. Uma consulta em lote obtém as 20 previsões Open-Meteo.
4. A estrutura e as séries são validadas; apenas uma resposta completa entra na cache.
5. A rota devolve uma política HTTP de uma hora para navegadores e caches compatíveis.
6. `fetchedAt` e `expiresAt` estabelecem a validade de uma hora; erros devolvem HTTP 503 e nunca são guardados como previsões.
7. O cliente mantém a resposta, agenda a renovação e comunica dados atrasados. Se um alojamento partilhado for limitado pelo fornecedor, consulta a mesma API diretamente no navegador e valida o mesmo contrato. Falhas têm tentativas limitadas e repetição espaçada.

A cache em memória é por processo/isolate e a cache HTTP depende da infraestrutura entre o servidor e o navegador. Não existe garantia de um único pedido global. Para tráfego muito elevado, considerar cache central durável e um plano da API adequado.

## Mapa

Cada região filtra os polígonos por `shapeISO`. Os polígonos e anéis interiores são triangulados/extrudidos, iluminados e selecionados com raycasting. Etiquetas HTML projetadas sobre a cena permitem interação acessível. Seleção e hover elevam o distrito; a cor usa a escala quantitativa da camada, exceto o distrito selecionado (dourado). O seletor continua disponível se WebGL falhar.

A bússola projeta, em cada frame, a origem e o vetor do norte geográfico através da mesma câmara do mapa. A diferença no ecrã determina a rotação da seta, pelo que continua alinhada quando o utilizador roda a cena.

## Sugestão de roupa

`lib/weather/clothing.ts` analisa as horas restantes do dia local. A sensação térmica mínima define a proteção base; vento forte pode aumentar um nível. A amplitude térmica, probabilidade máxima de chuva, humidade média e UV acrescentam recomendações visíveis. Perto da meia-noite são consideradas as seis horas seguintes para o conselho continuar útil. O cálculo é determinístico, testado e apresentado como orientação, não como garantia médica ou de segurança.

O motor é importado dinamicamente. O renderer limita a densidade de píxeis a 1,6 e os frames a cerca de 30/s. Mudanças de região desmontam e libertam geometria, materiais, eventos e controlos. Preferências de movimento reduzido desativam transições decorativas.

## Extensão

- Alterar referências meteorológicas: `lib/weather/districts.ts`.
- Novas métricas: contrato, pedido e validação em `lib/weather`, depois componentes.
- Tema ou mobile: `app/globals.css`.
- Outro fornecedor: manter `WeatherResponse` e substituir/adaptar `service.ts`.
- Credenciais futuras: variáveis de ambiente do servidor, nunca em componentes de cliente.

Os ficheiros `components/ui` pertencem ao catálogo gerado; compor e estilizar os componentes no ponto de uso.
