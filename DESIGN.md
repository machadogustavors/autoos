---
version: alpha
name: AutoOS
description: >-
  Painel de oficina, não app de consumo. Base grafite escura ({colors.canvas})
  com um laranja de segurança ({colors.primary}) para o único CTA por view —
  a mesma família de cor de ferramenta e sinalização de oficina. Sans do
  sistema em tudo, números de telemetria em monoespaçada (leitura de
  painel/instrumento). Radius 6 em botão, input e card. Borda 1px
  {colors.line}, sem sombra, sem pílula. Cobertura da V1 mobile — login,
  pátio de OS, criar OS, pareamento BLE, leitura de telemetria, itens,
  estoque, histórico do veículo, estados vazio/erro/offline.
colors:
  primary: "#FF6A1A"
  primary-deep: "#D9550F"
  on-primary: "#1A1200"
  primary-soft: "#3A2414"
  on-primary-soft: "#FF9A5C"
  canvas: "#17181A"
  surface: "#1F2124"
  surface-deep: "#26292D"
  ink: "#F5F3EF"
  muted: "#B7B2AA"
  faint: "#8B8680"
  line: "#2C2E31"
  line-strong: "#3C3F43"
  danger: "#FF5A5F"
  danger-soft: "#3A1E1F"
  on-danger: "#FFB4B7"
  ok: "#3DDC84"
  ok-soft: "#123320"
  on-ok: "#8CF0B3"
  warn: "#FFC53D"
  warn-soft: "#3A2E0A"
  on-warn: "#FFD980"
  link: "#FF9A5C"
typography:
  screen-title:
    fontFamily: System
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.20
  heading-1:
    fontFamily: System
    fontSize: 26px
    fontWeight: 700
    lineHeight: 1.20
  heading-card:
    fontFamily: System
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.30
  body-md:
    fontFamily: System
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.40
  body-md-medium:
    fontFamily: System
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.40
  body-sm:
    fontFamily: System
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.40
  caption:
    fontFamily: System
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.40
  micro:
    fontFamily: System
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.40
  micro-uppercase:
    fontFamily: System
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.40
    letterSpacing: 0.8px
  button-md:
    fontFamily: System
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.20
  telemetry-value:
    fontFamily: ui-monospace
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.20
  telemetry-unit:
    fontFamily: ui-monospace
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.40
rounded:
  xs: 3px
  sm: 6px
  md: 6px
  lg: 6px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  screen-gutter: 16px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: "14px 16px"
    height: 48px
  button-primary-pressed:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.on-primary}"
  button-primary-disabled:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    opacity: 0.4
  button-primary-loading:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: "14px 16px"
    height: 48px
    border: "1px solid {colors.line-strong}"
  button-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: "14px 16px"
    height: 48px
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.link}"
    typography: "{typography.body-md-medium}"
    padding: "0"
  card-service-order:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
    border: "1px solid {colors.line}"
  card-detail:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg}"
    border: "1px solid {colors.line}"
  panel-telemetry:
    backgroundColor: "{colors.surface-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
    border: "1px solid {colors.line}"
  chip:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.on-primary-soft}"
    typography: "{typography.micro}"
    rounded: "{rounded.xs}"
    padding: "4px 8px"
    border: "1px solid {colors.line}"
  chip-status-open:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.on-primary-soft}"
  chip-status-in-progress:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.on-warn}"
  chip-status-completed:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.on-ok}"
  chip-status-cancelled:
    backgroundColor: "{colors.surface-deep}"
    textColor: "{colors.faint}"
  chip-dtc:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.on-danger}"
    typography: "{typography.micro}"
    rounded: "{rounded.xs}"
    padding: "4px 8px"
  badge-ble:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.on-ok}"
    typography: "{typography.micro}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  banner-offline:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.on-primary-soft}"
    typography: "{typography.body-sm}"
    padding: "{spacing.sm} {spacing.md}"
    border: "0 0 1px {colors.line} solid"
  banner-error:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    typography: "{typography.body-sm}"
    padding: "{spacing.sm} {spacing.md}"
  empty-state:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    typography: "{typography.body-md}"
    padding: "{spacing.xl} {spacing.md}"
  skeleton-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    height: 96px
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm} {spacing.md}"
    border: "1px solid {colors.line-strong}"
    height: 48px
  text-input-focused:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "2px solid {colors.primary}"
  text-input-error:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "2px solid {colors.danger}"
  text-area:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
    border: "1px solid {colors.line-strong}"
    minHeight: 120px
  top-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.screen-title}"
    padding: "{spacing.sm} {spacing.md}"
    border: "0 0 1px {colors.line} solid"
    height: 56px
  list-screen:
    backgroundColor: "{colors.canvas}"
    padding: "0 {spacing.screen-gutter}"
---

## Overview

O AutoOS parece **painel de oficina**, não aplicativo de consumo. Fundo grafite escuro ({colors.canvas}), texto {colors.ink}, um laranja de segurança ({colors.primary}) no botão principal da view — a mesma família de cor de ferramenta, sinalização e macacão de oficina. Não é fintech clean, não é card SaaS com sombra suave, não é pílula.

Tema escuro por padrão e **não é estético**: reduz reflexo de luz de teto de oficina na tela e poupa a vista de quem olha o celular entre um serviço e outro, com as mãos sujas de graxa.

Números de telemetria (km, °C, V, DTC) usam **monoespaçada**, como um painel de instrumento — a leitura tem que parecer dado de sensor, não texto de app.

O SPEC diz o que a tela **faz**. Este arquivo diz o que ela **parece**. Hex e espaço no código: `app/theme/tokens.ts`. Se o hex aparecer no meio de um componente de tela, extraia.

Cobertura V1: login, pátio de OS, criar OS, detalhe, itens, estoque, pareamento BLE, painel de telemetria, histórico do veículo, estados vazio / loading / erro / offline.

**Assinatura:**
- Fundo `{colors.canvas}` em toda tela, painéis em `{colors.surface}`
- Um `{colors.primary}` por view (Nova OS, Parear dispositivo, Concluir OS)
- Card de OS: borda 1px, raio 6, sem sombra, lista vertical
- Telemetria: valores grandes em monoespaçada, DTC em chip de perigo
- Offline: faixa `{colors.primary-soft}` no topo, rascunho da OS continua editável
- Vazio: frase direta + um primário. Nunca tela em branco

## Colors

> Telas da V1: login, pátio, detalhe de OS, criar OS, estoque, pareamento BLE, telemetria, histórico. Mesma paleta em todas — tema escuro fixo, sem modo claro na V1.

### Brand
- **Primary** ({colors.primary}): laranja único. CTA, link, foco, badge de conexão ativa
- **Primary deep** ({colors.primary-deep}): pressionado
- **On primary** ({colors.on-primary}): texto escuro sobre o botão laranja (contraste alto: texto claro sobre laranja não passa AA)
- **Primary soft** ({colors.primary-soft}): chip, faixa offline, fundo de destaque

### Surface
- **Canvas** ({colors.canvas}): fundo de tela
- **Surface** ({colors.surface}): card, painel, input
- **Surface deep** ({colors.surface-deep}): esqueleto de loading, painel de telemetria (mais escuro que o card, para o número se destacar)
- **Line** ({colors.line}): borda 1px
- **Line strong** ({colors.line-strong}): borda de input

### Text
- **Ink** ({colors.ink}): título e corpo
- **Muted** ({colors.muted}): corpo secundário
- **Faint** ({colors.faint}): label, meta, timestamp, status `cancelled`

### Semantic
- **Danger** / **Danger soft** ({colors.danger}, {colors.danger-soft}): erro, DTC ativo, cancelar OS
- **Ok** / **Ok soft** ({colors.ok}, {colors.ok-soft}): concluída, dispositivo conectado
- **Warn** / **Warn soft** ({colors.warn}, {colors.warn-soft}): OS em andamento, reconectando
- **Link** ({colors.link}): laranja mais claro (contraste em fundo escuro)

Não acrescente acento. Sem azul, sem verde-limão, sem roxo — a paleta fala "ferramenta", não "startup".

## Typography

### Font Family
**System** em tudo: título de tela, corpo, botão, card, chip, input. SF no iOS (fora de escopo na V1), Roboto no Android. Sem serifa, sem fonte web baixada — é ferramenta de trabalho, não editorial.

**ui-monospace**: reservado para **valor de telemetria** (km, temperatura, tensão, RPM, código DTC). É a única família além da do sistema, e existe só para reforçar "isto é leitura de sensor".

### Hierarchy

| Token | Size | Weight | Family | Use |
|---|---|---|---|---|
| `{typography.heading-1}` | 26px | 700 | System | Título grande (login, vazio) |
| `{typography.screen-title}` | 20px | 700 | System | Top bar, nome da tela |
| `{typography.heading-card}` | 16px | 600 | System | Placa/título no card de OS |
| `{typography.body-md}` | 16px | 400 | System | Corpo |
| `{typography.body-md-medium}` | 16px | 500 | System | Ênfase, link |
| `{typography.body-sm}` | 14px | 400 | System | Meta, preview do card |
| `{typography.caption}` | 13px | 400 | System | Ajuda de campo |
| `{typography.micro}` | 12px | 600 | System | Chip de status |
| `{typography.micro-uppercase}` | 11px | 700 | System | Trilho curto (seção) |
| `{typography.button-md}` | 16px | 700 | System | Rótulo de botão (verbo) |
| `{typography.telemetry-value}` | 24px | 600 | mono | Valor de sensor (120, 92, 12.6) |
| `{typography.telemetry-unit}` | 12px | 400 | mono | Unidade (km, °C, V) |

### Principles
- Peso mais alto que o padrão editorial (600–700 no lugar de 400): precisa ler rápido, de relance, em pé.
- Corpo 16 / 1.40. Não comprima.
- Monoespaçada só em número de sensor. Nunca em texto de UI comum.
- Botão é verbo: Entrar, Nova OS, Parear dispositivo, Concluir OS, Tentar novamente.

## Layout

### Spacing
- Base **4px**. Use 4, 8, 12, 16, 24, 32.
- Tokens: `{spacing.xxs}` 4 · `{spacing.xs}` 8 · `{spacing.sm}` 12 · `{spacing.md}` 16 · `{spacing.lg}` 24 · `{spacing.xl}` 32
- Lateral de tela: `{spacing.screen-gutter}` (16px)
- Gap entre cards no pátio: `{spacing.sm}` (12px)

### Grid
- Uma coluna. Pátio é **lista**, não grade.
- Formulário: campos empilhados, gap `{spacing.md}`.

### Whitespace
Pátio denso o bastante para 3 cards acima da dobra. Tela vazia e login ganham `{spacing.xl}` acima da mensagem.

## Elevation & Depth

Sistema **plano**. Profundidade vem da borda e do contraste de superfície (`surface` vs `surface-deep`), não da sombra — sombra em tema escuro fica suja.

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | Sem sombra. Borda `1px {colors.line}` | Card, input, botão secundário |
| 1 (focus) | Borda `2px {colors.primary}` | Input focado |
| 2 (error) | Borda `2px {colors.danger}` | Campo inválido |

Sem `box-shadow`, sem blur, sem overlay escuro de modal (o fundo já é escuro — modal usa `surface-deep`, não escurecer mais).

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 3px | Chip |
| `{rounded.sm}` | 6px | Botão, input, card, painel |
| `{rounded.md}` | 6px | Igual ao sm |
| `{rounded.lg}` | 6px | Igual. Sem card 12/16 |
| `{rounded.full}` | 9999px | Só no badge de status BLE (bolinha). **Proibido** em botão |

Geometria quase reta, canto de instrumento, não de app consumer.

## Components

Estados documentados: default, pressed, disabled, loading. Sem hover (é app touch).

### Buttons

**`button-primary`** — ação principal da tela. Uma por view.
- Fundo `{colors.primary}`, texto `{colors.on-primary}` (escuro — contraste sobre laranja), `{typography.button-md}`, altura 48, `{rounded.sm}`.
- Pressed: `{colors.primary-deep}`. Disabled: opacidade 0.4. Loading: indicador no lugar do texto, largura fixa.
- Uso: Entrar, Nova OS, Parear dispositivo, Concluir OS.

**`button-secondary`** — cancelar, voltar, tentar novamente.
- Fundo transparente, texto `{colors.ink}`, borda `1px {colors.line-strong}`, altura 48, `{rounded.sm}`.

**`button-danger`** — cancelar OS, remover item.
- Fundo `{colors.danger-soft}`, texto `{colors.danger}`, altura 48, `{rounded.sm}`.

**`button-link`** — ação textual (ver histórico do veículo).
- Texto `{colors.link}`, `{typography.body-md-medium}`.

### Cards

**`card-service-order`** — item do pátio.
- Fundo `{colors.surface}`, borda `1px {colors.line}`, `{rounded.sm}`, padding `{spacing.md}`.
- Título = placa do veículo, `{typography.heading-card}`. Subtítulo = cliente + marca/modelo, `{typography.body-sm}` `{colors.muted}`.
- Chip de status na base. Se houver leitura recente com DTC, `chip-dtc` aparece ao lado do status. Sem descrição completa (isso é do detalhe).

**`card-detail`** — tela de uma OS.
- Mesmo tratamento. Padding `{spacing.lg}`. Corpo `{typography.body-md}`.

**`panel-telemetry`** — bloco de leitura do dispositivo, dentro do detalhe da OS ou na tela de pareamento.
- Fundo `{colors.surface-deep}` (mais escuro que o card, pra destacar o número).
- Cada métrica: label `{typography.caption}` `{colors.faint}` em cima, valor `{typography.telemetry-value}` + unidade `{typography.telemetry-unit}` embaixo.
- DTCs (se houver): lista de `chip-dtc`, um por código.
- Sem gráfico na V1 — só o snapshot mais recente. Histórico de série temporal vive no LARCC, não nesta tela.

### Chips e badges

**`chip-status-*`** — `open` (laranja soft), `in-progress` (âmbar soft), `completed` (verde soft), `cancelled` (cinza/faint).
**`chip-dtc`** — código de falha (`P0301`). Fundo de perigo — DTC é sempre alerta, nunca neutro.
**`badge-ble`** — bolinha + rótulo curto: "Conectado" (ok), "Conectando…" (warn), "Desconectado" (faint).

### Banners and empty

**`banner-offline`** — faixa no topo. "Sem conexão. O rascunho da OS continua salvo." Não bloqueia a tela.
**`banner-error`** — erro da **seção**. Sem código HTTP. Ação: `button-secondary` "Tentar novamente".
**`empty-state`** — "Nenhuma OS aberta." + `button-primary` "Nova OS".
**`skeleton-card`** — primeiro load. Blocos `{colors.surface}`, altura ~96px, 3 no pátio.

### Inputs

**`text-input`** — altura 48, borda `{colors.line-strong}`, `{rounded.sm}`.
**`text-input-focused`** — borda 2px `{colors.primary}`.
**`text-input-error`** — borda 2px `{colors.danger}` + caption abaixo.
**`text-area`** — descrição da OS. minHeight 120. Rascunho não some no retry.

### Chrome

**`top-bar`** — nome da tela em `{typography.screen-title}`, fundo canvas, borda inferior 1px, altura 56.
**`list-screen`** — fundo canvas, gutter 16.

## Screens (V1)

| Tela | Primário | Notas |
|---|---|---|
| Login | Entrar | Sem Google, sem cadastro self-service — usuário é criado no servidor |
| Pátio | Nova OS | Lista de OS `open` / `in_progress`. Offline = banner + cache |
| Pátio vazio | Nova OS | Mensagem + um primário |
| Nova OS | Criar OS | Selecionar/cadastrar cliente e veículo. Rascunho não some se a rede cair |
| Detalhe da OS | Concluir OS (se aberta/em andamento) | `card-detail` + `panel-telemetry` + itens |
| Pareamento BLE | Parear | Lista de dispositivos encontrados. `badge-ble` de status |
| Telemetria (dentro do detalhe) | — | Snapshot mais recente. Sem histórico gráfico na V1 |
| Itens da OS | Adicionar item | Peça (do estoque ou avulsa) ou serviço, descrição, sem preço |
| Estoque | Cadastrar peça | Lista com quantidade; ajuste manual (RF-20). Busca reaproveitada ao adicionar item |
| Histórico do veículo | — | Lista de OS anteriores da mesma placa |
| Erro de seção | Tentar novamente (secundário) | |

## Do's and Don'ts

### Do
- Reserve `{colors.primary}` para o único CTA da view, link e foco
- Use `{colors.canvas}` como fundo de **toda** tela, `{colors.surface}` para card/painel
- `{rounded.sm}` (6px) em botão, input e card
- Monoespaçada só em valor de telemetria
- Altura de toque 48 (maior que o padrão de 44 — assume uso com dedo sujo/luva fina)
- Extraia hex para `app/theme/tokens.ts`

### Don't
- Não use pílula (`{rounded.full}`) em botão
- Não invente cor de acento (azul, roxo, verde-limão)
- Não ponha dois primários na mesma view
- Não use sombra, glass, gradiente
- Não mostre HTTP, hex, JSON ou tópico MQTT para o mecânico
- Não desenhe gráfico de série temporal na V1 — isso é painel do LARCC, fora do app
- Não desenhe chat, push nativo ou upload de arquivo

## Responsive Behavior

App nativo, uso em pé/no pátio. Sem breakpoint de marketing site.

| Name | Width | Key Changes |
|---|---|---|
| Phone | 320–430 | Layout canônico. Gutter 16 |
| Large phone | 430–500 | Mesma coluna |
| Tablet | ≥ 600 | Uma coluna, max 560 no conteúdo. Sem sidebar na V1 |

### Touch
- Botão e input: 48px (maior que o padrão de app comum — contexto de oficina)
- Card inteiro é tocável no pátio

### Collapsing
- Top bar fica. Título trunca com ellipsis (placas longas, nomes compostos)
- Banner offline full width
- Teclado: o botão primário do formulário sobe com o teclado

## Iteration Guide

1. Um componente por vez (`button-primary`, `card-service-order`, `panel-telemetry`)
2. Cite o token: `{colors.primary}`, `{rounded.sm}`, `button-primary-pressed`
3. Corpo default: `{typography.body-md}`. Número de sensor: `{typography.telemetry-value}`
4. Cards, botões e painéis: `{rounded.sm}` (6px)
5. Hex só em `app/theme/tokens.ts`
6. Depois de mudar token, atualize este YAML e o código no mesmo PR
7. Prompt: "implemente o pátio RF-05 com `card-service-order`, `banner-offline` e `empty-state` conforme DESIGN.md"

## Code

```text
app/theme/tokens.ts       colors, spacing, rounded, type
app/ui/Button.tsx         variants: primary, secondary, danger
app/ui/Card.tsx           card-service-order, card-detail
app/ui/TelemetryPanel.tsx panel-telemetry
app/ui/Chip.tsx           status, dtc
app/ui/BleBadge.tsx       badge-ble
app/ui/Banner.tsx         offline, error
```

## Known Gaps

- `tokens.ts` ainda não existe. Crie na primeira tela, copiando o YAML
- Sem modo claro na V1 — tema escuro é decisão de produto (luz de oficina), não falta de tempo
- Sem tab bar documentada: V1 pode ser stack (login → pátio → detalhe)
- Sem ícone de marca desenhado. Wordmark "AutoOS" em `{typography.heading-1}` basta
- Sem gráfico de série temporal no app — fica no dashboard do LARCC (Grafana), fora deste DESIGN
- Motion: 150ms no press. Sem bounce
