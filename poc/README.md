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

### Movimento e "feel" da nave
- **Movimento por força** (`controls.motion`): cada eixo acelera na direção do input com `accel` (m/s²), desacelera até parar com `decel` ao soltar as teclas, e freia contra a direção oposta com `brake` (mais forte que `accel`) — pressionando o lado contrário do movimento, a troca de direção é mais rápida. A velocidade é limitada a `maxSpeed`.
- **Tilt/bank** (`controls.tilt`): ao virar (A/D) a nave inclina em **`rotation.z`** até `maxDeg` (90°) com rampa de `riseMs` (300ms); soltando, volta a zero em `fallMs` (400ms). Eixo (`axis`) e direção (`sign`) configuráveis.

### Como o parallax se resolve a partir do movimento

A sensação de velocidade/deslocamento no fundo não é calculada direto da nave — ela **herda do movimento real da câmera**. A cadeia é:

1. **Nave por força** (`controllers.ts` — `axisVelocity`): o input vira aceleração (`accel`/`brake`), integrada a cada frame em `vx/vz` e limitada por `maxSpeed`; `shipTransform.position` desloca-se.
2. **Dead-zone** (`follow.ts` / `followBox`): a nave se move **livremente dentro** do follow box (`halfX`/`halfZ`) em torno da âncora. Enquanto não encosta na borda, a câmera não se move — a nave "navega no box".
3. **Follow da câmera** (`followCamera.ts`): só quando a nave ultrapassa a borda a âncora desliza (`nx/nz`), puxando `camera.position` junto. Ou seja, **translação de câmera por input de nave só existe quando a nave transborda o box**. As teclas de câmera (IJKL/R/F) deslocam a câmera à parte, a qualquer momento.
4. **Parallax** (`parallax.ts`): a cada frame, cada camada mede o **Δ da posição da câmera** (`camDX/DY/DZ` entre frames) e desloca suas estrelas em **sentido contrário** multiplicado por `parallaxGain` da camada:
   `estrela −= Δcâmera × parallaxGain × (1 ± jitter)`.
   As grades (presas à posição da câmera, orientação/rotação independentes) ficam paradas; só as estrelas "escorregam" nelas — isso produz a profundidade. Além disso, as estrelas têm voo próprio em Z (`speed`) com wrap (`zNearWrap`, `zFar`).

**Resultado prático:** com a câmera parada, o fundo não reage ao WASD (a nave apenas se move no box). Parallax de movimento acontece quando (a) a nave empurra a borda do box e arrasta a câmera, ou (b) a câmera é movida por IJKL/R/F. Cada camada é disposta em profundidade pelo `position` relativo à câmera (hoje: `Y = −300 → −800 → −3000`, com grades de `gridSize` crescente), e o quanto suas estrelas "escorregam" ao movimento da câmera é o fator `parallaxGain` (hoje `0.15` uniforme). A escala de profundidade é diretamente `position` + `gridSize` + `parallaxGain`.

---

## O que a POC tem hoje

### Cena e render (`src/main.ts`, `src/gameobjects/`)
- **Canvas portrait fixo 9:16** — buffer interno 540×960 (`BALANCE.layout.playfield`), centralizado na janela; laterais mostram informação (legenda de controles à esquerda, painel de debug à direita); em telas ≤ 760px as colunas somem e o canvas preenche a largura.
- **Nave** (`ship.ts`) — caixa wireframe neon + semicone como thruster com flicker `.update(dt)`, transform aplicado via `applyTransform`.
- **Câmera** (`cameraRig.ts`) — `PerspectiveCamera` com `rotation.order = 'YXZ'`, config aplicada por `applyConfig` (FOV/aspect/near/far/posição/rotação).
- **Follow Box** (`followBox.ts`) — `LineLoop` desenhado no plano XZ ao redor de um centro configurável (posição) com meia-largura/meia-profundidade; **dead-zone** da câmera (`followCamera.ts`) usa o mesmo centro/tamanho — resize/posição ao vivo pelo painel.
- **Parallax** (`parallax.ts`) — camadas horizontais paralelas à base da nave, **presas à posição da câmera** (não à rotação: cada grade mantém rotação própria editável). Cada camada tem grade (`gridSize`, `gridOpacity`) e estrelas que reagem ao Δ da câmera com `parallaxGain`, além de voo próprio em Z (`speed`, `zNearWrap`, `zFar`). Configuráveis por layer.
- **Gizmos** (`gizmos.ts`) — eixos do mundo (XY Z), grade de playfield e eixos da câmera (sprite labels), acompanhando a câmera a cada frame.

### Overlays (DOM sobre o canvas)
- **Coordenadas da nave** (`shipCoords.ts`) — etiqueta `X / Y / Z` projetada "sobre a nave"; mapeia World→screen com `vector.project` + `getBoundingClientRect` do canvas (letterbox-safe), clamp nas margens, some quando atrás da câmera.
- **Painel de debug** (`debugControls.ts`) — coluna direita: readouts ao vivo (posição da nave/câmera), sliders/spins para Câmera (FOV, posição, rotação, near/far **+ Control:** move/rot speed), Nave (posição, rotação, escala **+ Motion:** maxSpeed/accel/decel/brake **+ Tilt:** axis/sign/maxDeg/rise/fall), **Follow Box** (posição X/Y/Z, Half Width X, Half Depth Z), Parallax (por camada: count/speed/jitter/gain/tamanho/posição/rotação/tamanho da grade/opacidade/profundidades) e botão **Reset**.
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
      controllers.ts              # input -> movimento da nave (acel/tilt) + câmera
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
| `controls.shipKeys / motion / tilt / camera` | Mapa de teclas, força (accel/decel/brake) + `maxSpeed`, bank (graus + ms) e move/rot speed da câmera |
| `ship.transform / follow / followBox` | Posição inicial, tamanho do dead-zone e posição/estilo da caixa |
| `ship.visual` | Dimensões e cores wireframe da nave/thruster |
| `camera` | FOV, posição/rotação iniciais, near/far |
| `parallax.layers[]` | Por camada: contagem, velocidade/scroll das estrelas, `parallaxGain` (reação ao Δ da câmera), posição relativa à câmera e rotação da grade, tamanho (`gridSize`) e opacidade da grade (`gridOpacity`), profundidades de voo (`zNearWrap`/`zFar`) |
| `thruster` | Posição/dimensões do jato |

---

## Notas / estado

- Spike devida ao `phase-0-poc.md`: algumas features (label de coords, layout portrait, follow box) são **dev tools / previews** — sem requisito `*.spec.MD` locked.
- Sem áudio, colisão, inimigos, HUD de jogo ou persistência ainda (fora de escopo desta fase).
- O GDD e o planejamento ficam em `.docs/` (git-ignored) — busque com `rg --no-ignore "#tag/..."`.