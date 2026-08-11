# Ikarus: Eternal Horizon — POC

Prova de conceito (spike, pré-G0) do vertical slice planejado em [`.docs/phases/phase-0-poc.md`](../.docs/phases/phase-0-poc.md).
Este projeto é **experimental** — valida visão e mecânica de câmera/nave, e não é o projeto oficial.

**Stack:** TypeScript · Vite · Three.js. Fonte canônica de balanceamento: `src/core/balancer.ts` (números fora do código de gameplay).

---

## Como rodar

```bash
npm install
npm run dev     # dev server Vite
npm run build   # tsc + vite build -> dist/
npm run preview # prévia do build de produção
```

---

## Controles

| Ação | Teclas |
|---|---|
| Mover a **nave** (X/Z) | `W / A / S / D` |
| Mover a **câmera** (Z / X / Y) | `I / K` · `J / L` · `R / F` |
| Rotacionar a **câmera** — pitch `8 / 2` | numpad ou fileira de números (`Numpad8|2`, `Digit8|2`) |
| Rotacionar a **câmera** — roll `7 / 9` | numpad ou fileira de números |
| Rotacionar a **câmera** — yaw `4 / 6` | numpad ou fileira de números |

> Este mapa é **único e simultâneo**: não existe troca de modo. WASD move a nave o tempo todo; IJKL + numpads controlam a câmera o tempo todo. A câmera ainda respeita o **dead-zone** (followBox): quando a nave encosta na borda da caixa, câmera e caixa acompanham.

---

## O que a POC tem hoje

### Cena e render (`src/main.ts`, `src/gameobjects/`)
- **Canvas portrait fixo 9:16** — buffer interno 540×960 (`BALANCE.layout.playfield`), centralizado na janela; laterais mostram informação (legenda de controles à esquerda, painel de debug à direita); em telas ≤ 760px as colunas somem e o canvas preenche a largura.
- **Nave** (`ship.ts`) — caixa wireframe neon + semicone como thruster com flicker `.update(dt)`, transform aplicado via `applyTransform`.
- **Câmera** (`cameraRig.ts`) — `PerspectiveCamera` com `rotation.order = 'YXZ'`, config aplicada por `applyConfig` (FOV/aspect/near/far/posição/rotação).
- **Follow Box** (`followBox.ts`) — `LineLoop` desenhado no plano XZ ao redor de um centro configurável (posição) com meia-largura/meia-profundidade; **dead-zone** da câmera (`followCamera.ts`) usa o mesmo centro/tamanho — resize/posição ao vivo pelo painel.
- **Parallax** (`parallax.ts`) — 3 camadas (stars / debris / mesh) com velocidade, spans e grade próprios, configuráveis por layer.
- **Gizmos** (`gizmos.ts`) — eixos do mundo (XY Z), grade de playfield e eixos da câmera (sprite labels), acompanhando a câmera a cada frame.

### Overlays (DOM sobre o canvas)
- **Coordenadas da nave** (`shipCoords.ts`) — etiqueta `X / Y / Z` projetada "sobre a nave"; mapeia World→screen com `vector.project` + `getBoundingClientRect` do canvas (letterbox-safe), clamp nas margens, some quando atrás da câmera.
- **Painel de debug** (`debugControls.ts`) — coluna direita: readouts ao vivo (posição da nave/câmera), sliders/spins para Câmera (FOV, posição, rotação, near/far), Nave (posição, rotação, escala), **Follow Box** (posição X/Y/Z, Half Width X, Half Depth Z), Parallax (todos os parâmetros por camada) e botão **Reset**.
- **Legenda de controles** — coluna esquerda, estática em `index.html`.

### Input (`src/core/input.ts`)
- Estado central de teclas com `preventDefault` na lista controlada; `blur` limpa o estado. Arrows também mapeadas.

---

## Arquitetura

```
poc/
  index.html                      # shell flex: legend (esq) · #app (canvas) · #panel (dir)
  src/
    main.ts                       # bootstrap, loop rAF (dt clamp), composição de sistemas
    style.css                     # layout portrait + neon theme
    core/
      balancer.ts                 # BALANCE: todos os números/settings
      input.ts                    # estado de teclado
    gameobjects/
      cameraRig.ts                # PerspectiveCamera + applyConfig
      ship.ts                     # nave wireframe + thruster
      parallax.ts                 # 3 camadas parallax
      followBox.ts                # caixa dead-zone (LineLoop)
      gizmos.ts                   # eixos mundiais, grade, eixos da câmera
    systems/
      cameraControls.ts           # move/rotate da câmera por input
      shipControls.ts             # move da nave por input
      followCamera.ts             # dead-zone follow (âncora = centro da caixa)
      shipCoords.ts               # label X/Y/Z sobre a nave
      debugControls.ts            # painel de debug (sliders/readouts/reset)
```

Regra do projeto (docs POC §7): *GameObject* na forma `init → update(dt) → syncRender → dispose`; fábricas/functions, sem ECS; `BALANCE` como única fonte de números; zero alocação por frame em hot path.

---

## Onde mexer nos números

Tudo em `src/core/balancer.ts`:

| Bloco | O que controla |
|---|---|
| `layout.playfield` | Resolução base do canvas portrait |
| `ship.transform / moveSpeed` | Posição inicial e velocidade de deslocamento da nave |
| `ship.follow / followBox` | Tamanho do dead-zone e posição/estilo da caixa |
| `ship.visual` | Dimensões e cores wireframe da nave/thruster |
| `camera` | FOV, posição/rotação iniciais, near/far, velocidades de move/rot |
| `parallax.layers[]` | Contagem, velocidade, cores, spans, Y dos layers e grade |
| `thruster` | Posição/dimensões do jato |

---

## Notas / estado

- Spike devida ao `phase-0-poc.md`: algumas features (label de coords, layout portrait, follow box) são **dev tools / previews** — sem requisito `*.spec.MD` locked.
- Sem áudio, colisão, inimigos, HUD de jogo ou persistência ainda (fora de escopo desta fase).
- O GDD e o planejamento ficam em `.docs/` (git-ignored) — busque com `rg --no-ignore "#tag/..."`.