# Fontes e atribuição

## Meteorologia

- Open-Meteo Weather Forecast API: https://open-meteo.com/en/docs
- Dados sob CC BY 4.0: https://open-meteo.com/en/licence

## Previsão meteorológica de reserva

- MET Norway Locationforecast 2.0: https://api.met.no/weatherapi/locationforecast/2.0/documentation
- Termos e identificação do cliente: https://api.met.no/doc/TermsOfService
- Dados MET Norway sob CC BY 4.0 / NLOD 2.0: https://api.met.no/doc/License.html
- A integração usa o endpoint `complete`, identifica o projeto no `User-Agent`, limita a concorrência e mantém cache de uma hora.
- A MET Norway não fornece probabilidade de precipitação nesta série global; durante a reserva, a escala de chuva é uma categoria conservadora derivada da quantidade e do símbolo meteorológico recebidos.
- Plano gratuito e limites: https://open-meteo.com/en/pricing
- Conversões na aplicação: arredondamento de valores, interpretação de códigos WMO, seleção de horas e apresentação em fusos locais.

## Geografia

- Distribuição: geoBoundaries, `gbOpen/PRT/ADM1`, boundary ID `PRT-ADM1-24955722`.
- Fonte original: Direção-Geral do Território (DG Territory).
- Metadados: https://www.geoboundaries.org/api/current/gbOpen/PRT/ADM1/
- Dados geográficos representam 2016; build de 12 de dezembro de 2023.
- Licença declarada para este conjunto: Open Data Commons Open Database License 1.0 (ODbL).
- Ficheiro simplificado original: https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/PRT/ADM1/geoBoundaries-PRT-ADM1_simplified.geojson
- Cópia original em `public/portugal-districts.geojson`. Os rótulos usam os códigos ISO porque alguns nomes na fonte têm problemas de codificação.
- Transformação apenas na visualização: projeção local com correção de longitude por latitude, normalização de escala e extrusão. Não representa elevação do terreno.

## Interface

Ícones Lucide (ISC), Three.js (MIT), React (MIT), Recharts (MIT), TanStack Query (MIT) e componentes do starter Shadcn/Base UI. Consulte as licenças das dependências para redistribuição.
