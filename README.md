# O Céu de Portugal

Meteorologia em português com um mapa 3D navegável dos **18 distritos**, Madeira e Açores. Interface adaptada a computador, tablet e telemóvel.

## Desenvolvimento

Requisitos: Node.js 22.13+ e npm.

```sh
npm ci
npm run dev
```

Abra o endereço indicado pelo servidor (normalmente http://localhost:3000).
Não é necessária uma chave para a API meteorológica.

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run start` serve o build com Wrangler. O lint cobre o código da aplicação; o catálogo de componentes do starter permanece independente. O TypeScript verifica também os componentes importados.

## Estrutura

```text
app/
  page.tsx                  Entrada da aplicação
  layout.tsx                Idioma, fontes e metadados
  globals.css               Tema, animações e breakpoints
  api/weather/route.ts      Endpoint meteorológico e política de cache HTTP
components/
  map/PortugalMap.tsx       Cena Three.js, geometrias, câmara e seleção
  weather/
    WeatherDashboard.tsx   Estado, navegação e barra temporal
    WeatherPanel.tsx       Condições atuais do distrito
    ForecastDetails.tsx    Previsão horária e de sete dias
    ClothingAdvice.tsx     Sugestão de roupa baseada na evolução do dia
    WeatherIcon.tsx        Ícones por código WMO e dia/noite
  ui/                       Primitivos acessíveis do starter Shadcn/Base UI
hooks/use-weather.ts        Consulta, atualização horária e recuperação de rede
lib/weather/
  districts.ts              Identificadores, coordenadas e fusos horários
  types.ts                  Contrato dos dados
  service.ts                API, validação, cache e deduplicação
  format.ts                 Horas, unidades e descrições WMO
  colors.ts                 Escalas quantitativas das cores do mapa
  clothing.ts               Regras explicáveis para a roupa sugerida
lib/map/compass.ts          Orientação da bússola no ecrã
public/
  portugal-districts.geojson Limites geográficos reais, servidos localmente
tests/weather.test.ts       Cache, concorrência, erros, fusos e cobertura
docs/                      Arquitetura, fontes e validação
.openai/hosting.json         Identificação e configuração de Sites
```

## Dados e atualização

A [Open-Meteo](https://open-meteo.com/en/docs) combina modelos meteorológicos e escolhe o modelo disponível para cada coordenada (`best_match`). O servidor pede as 20 referências em lote e guarda uma resposta durante **3 600 segundos**. Pedidos simultâneos no mesmo processo partilham a mesma consulta e a resposta inclui uma política HTTP de uma hora para o navegador e caches compatíveis.

O navegador atualiza ao expirar a resposta. Ao regressar a uma aba ou recuperar a rede, volta a consultar se os dados expiraram. Uma aba fechada não precisa de continuar a fazer pedidos: o primeiro acesso após a expiração renova os dados. Não existe uma tarefa agendada a consumir a API sem visitantes. Se o alojamento partilhado for limitado pela Open-Meteo, a aplicação muda automaticamente para uma consulta direta no navegador, com a mesma validação e cadência. Em caso de falha, mantém a última previsão na sessão, identifica-a como atrasada e permite tentar novamente. Nunca substitui uma falha por dados inventados.

As coordenadas são **capitais de distrito**, Funchal (Madeira) e Ponta Delgada (Açores). São referências pontuais; não representam médias distritais ou todas as condições de cada arquipélago. O painel informa esta limitação. Chuva no mapa significa **probabilidade**, não imagem de radar. O relevo do mapa é uma extrusão gráfica de fronteiras, não altitude topográfica.

A API gratuita é destinada a **uso não comercial**, com limites de pedidos. Para monetização, publicidade ou maior escala, consultar [os planos e condições](https://open-meteo.com/en/pricing). A cache reduz os pedidos; os limites contabilizam coordenadas e variáveis, não apenas pedidos HTTP.

## Interação e acessibilidade

- Arrastar roda o mapa; a seta da bússola acompanha o norte geográfico; pinça/roda do rato e botões controlam o zoom; botão de reposição recentra a vista.
- Seleção pelos polígonos, etiquetas, lista ou seletor de distrito no telemóvel.
- Camadas de temperatura, probabilidade de chuva e vento; evolução das próximas 24 horas com pausa e controlo por teclado.
- O painel apresenta as condições atuais. A barra temporal altera apenas o mapa, explicitamente identificado.
- A sugestão de roupa considera a sensação térmica, humidade, vento, chuva, UV e a evolução horária restante do dia. É indicativa e mostra os fatores que justificam o conselho.
- Sem WebGL, a previsão continua disponível através dos controlos acessíveis.
- Respeita `prefers-reduced-motion`; limita resolução e frequência do mapa e suspende a renderização quando a aba está oculta.
- Ferramentas WebMCP opcionais: `show_district_weather` e `get_selected_weather`.

## Publicação

O build gera um Worker compatível com Cloudflare, com os assets do cliente em `dist/client` e o servidor em `dist/server`. A configuração Sites é versionada; tokens, caches e artefactos de build são ignorados. Ver `docs/ARCHITECTURE.md` e `docs/SOURCES.md`.
