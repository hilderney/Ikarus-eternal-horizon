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
| **Disparar** arma principal | `Space` |
| **Trocar de arma** | `F` |
| Mover a **câmera** (Z / X / Y) | `I / K` · `J / L` · `U / O` |
| Rotacionar a **câmera** — pitch `↓ / ↑` | `Shift+K` / `Shift+I` |
| Rotacionar a **câmera** — roll `N / M` | `Shift+O` / `Shift+U` |
| Rotacionar a **câmera** — yaw `→ / ←` | `Shift+L` / `Shift+J` |

> Este mapa é **único e simultâneo**: não existe troca de modo. WASD move a nave o tempo todo; IJKL/UO movem a câmera e Shift+IJKL/UO rotacionam, tudo ao mesmo tempo. O follow box limita a câmera: quando a nave toca a borda (`halfX`/`halfZ`) a câmera acompanha; e quando a nave fica **parada** o auto-recenter suave reposiciona a câmera (mover interrompe; retoma com a nave parada por `stillMs`) até a **Recenter Point** — um **ponto único fixo relativo ao box** (default `position {0,0,-1}`: em X no centro do box; em Z a 1 unidade *para dentro* da borda da base, `anchor.z + halfZ + z`). Ao se mover, a câmera desloca os itens do parallax com o ganho `parallaxGain` — sensação de perspectiva/movimento.

> **Disparo (weapons):** `Space` atira a arma ativa (serrilhada com a cadência e Energia da arma); `F` (ou o seletor na aba **Weapons** do painel de debug) troca a arma ativa pela próxima do loadout. As 4 armas consomem Energia do mesmo pool — `energy` em `balanced`/painel.

### Movimento e "feel" da nave
- **Movimento por força** (`controls.motion`): cada eixo acelera na direção do input com `accel` (m/s²), desacelera até parar com `decel` ao soltar as teclas, e freia contra a direção oposta com `brake` (mais forte que `accel`) — pressionando o lado contrário do movimento, a troca de direção é mais rápida. A velocidade é limitada a `maxSpeed`.
- **Tilt/bank** (`controls.tilt`): ao virar (A/D) a nave inclina em **`rotation.z`** até `maxDeg` (22°, com `axis`/`sign` configuráveis) com rampa de `riseMs` (150ms); soltando, volta a zero em `fallMs` (200ms).

### Como o parallax se resolve a partir do movimento

A sensação de velocidade/deslocamento no fundo não é calculada direto da nave — ela **herda do movimento real da câmera**. A cadeia é:

1. **Nave por força** (`controllers.ts` — `axisVelocity`): o input vira aceleração (`accel`/`brake`), integrada a cada frame em `vx/vz` e limitada por `maxSpeed`; `shipTransform.position` desloca-se.
2. **Dead-zone** (`follow.ts` / `followBox`): a nave se move **livremente dentro** do follow box (`halfX`/`halfZ`) em torno da âncora. Enquanto não encosta na borda, a câmera não se move — a nave "navega no box".
3. **Follow + recenter** (`followCamera.ts`):
   - **Follow de borda com "bounce" (dead-zone, X e Z):** quando a nave toca/ultrapassa a borda do box (`halfX`/`halfZ`), a câmera acompanha **suavizada** — começa a seguir devagar e assenta no ponto em `bounce.timeMs` (ms), em vez de seguir seco (imediato). Enquanto o recenter está ativo, o edge-follow é suspenso no mesmo eixo para os dois sistemas não brigarem.
   - **Auto-recenter ao parar (Recenter Point único):** sempre que a nave fica **parada** (`moving` < `MOVE_EPS`) e fora do ponto de repouso por mais de `CENTER_EPS`, **dentro ou fora do box**, após `recenter.delayMs` a câmera desliza por força (`recenter.accel`, limitado a `recenter.maxSpeed`) — aproximando a nave do **Recenter Point**, um ponto fixo relativo ao box (`restLine.position`). Ambos os eixos derivam o repouso do *mesmo* ponto (caminho direto nave→ponto): **X** com `restOffset = position.x`; **Z** com `restOffset = position.z + halfZ` (medido da borda da base, `anchor.z + halfZ + z`). Se a nave começa a se mover a força para (`interrupt`) e só retoma depois que ela fica parada por `recenter.stillMs`; estado independente por eixo (mover em Z não interrompe o recenter de X e vice-versa).
   A linha de centro (visual, `followBox.centerLine`) cruza o box na vertical ao longo do eixo Z, marcando o centro lateral X. O marcador azul **Recenter Point** (`restLine`) finca-se exatamente onde a câmera posiciona a nave ao recentrar — X no meio do box e Z a `position.z` para dentro da base — e é editável ao vivo no painel (aba Follow Box → **Recenter Point**), movendo junto marcador **e** alvo.
4. **Parallax** (`parallax.ts`): a cada frame, cada camada mede o **Δ da posição da câmera** em qualquer eixo (`camDX/DY/DZ` entre frames) e desloca suas estrelas em **sentido contrário** multiplicado por `parallaxGain` da camada — efeito de **ganho de perspectiva/movimento**: quanto maior o `parallaxGain`, mais os itens do grid "escorregam" quando a câmera se move:
   `estrela −= Δcâmera × parallaxGain × (1 ± jitter)`.
   As grades (presas à posição da câmera, orientação/rotação independentes) ficam paradas; só as estrelas "escorregam" nelas — isso produz a profundidade. Além disso, as estrelas têm voo próprio em Z (`speed`) com wrap (`zNearWrap`, `zFar`).

**Resultado prático:** com a câmera parada, o fundo não reage ao movimento da nave dentro do box. Parallax de movimento acontece sempre que a câmera se move: (a) follow de borda quando a nave encosta no box (X/Z), (b) recenter quando a nave fica parada (após `recenter.delayMs`, aproximando da Recenter Point), ou (c) teclas IJKL/RF. Cada camada é disposta em profundidade pelo `position` relativo à câmera (hoje: `Y = −300 → −350 → −400`, todas com `gridSize` 1000), e o quanto suas estrelas "escorregam" ao movimento da câmera é o fator `parallaxGain` (hoje `0.15 → 0.09 → 0.03`, da de fundo para a de frente). A escala de profundidade é diretamente `position` + `gridSize` + `parallaxGain`.

---

## O que a POC tem hoje

### Cena e render (`src/main.ts`, `src/gameobjects/`)
- **Canvas portrait fixo 9:16** — buffer interno 540×960 (`BALANCE.layout.playfield`), centralizado na janela e dimensionado pelo tamanho da tela (`height: min(100vh,100%)`); as **laterais preenchem o espaço restante** (legenda de controles à esquerda, painel de debug à direita); em telas ≤ 760px as colunas somem e o canvas preenche a largura.
- **Nave** (`ship.ts`) — caixa wireframe neon + semicone como thruster com flicker `.update(dt)`, transform aplicado via `applyTransform`.
- **Câmera** (`cameraRig.ts`) — `PerspectiveCamera` com `rotation.order = 'YXZ'`, config aplicada por `applyConfig` (FOV/aspect/near/far/posição/rotação).
- **Follow Box** (`followBox.ts`) — `LineLoop` desenhado no plano XZ ao redor de um centro configurável (posição) com meia-largura/meia-profundidade; **dead-zone** da câmera (`followCamera.ts`) usa o mesmo centro/tamanho — resize/posição ao vivo pelo painel. O recenter re-centraliza a nave quando ela fica parada, dentro ou fora do box, aproximando-a do **Recenter Point** (marcador azul `restLine`): ponto único fixo relativo ao box — X no centro, Z a `position.z` para dentro da borda da base (`anchor.z + halfZ + z`).
- **Parallax** (`parallax.ts`) — camadas horizontais paralelas à base da nave, **presas à posição da câmera** (não à rotação: cada grade mantém rotação própria editável). Cada camada tem grade (`gridSize`, `gridOpacity`) e estrelas que reagem ao Δ da câmera com `parallaxGain`, além de voo próprio em Z (`speed`, `zNearWrap`, `zFar`). Configuráveis por layer.
- **Gizmos** (`gizmos.ts`) — eixos do mundo (XY Z), grade de playfield e eixos da câmera (sprite labels), acompanhando a câmera a cada frame.

### Overlays (DOM sobre o canvas)
- **Coordenadas da nave** (`shipCoords.ts`) — etiqueta `X / Y / Z` projetada "sobre a nave"; mapeia World→screen com `vector.project` + `getBoundingClientRect` do canvas (letterbox-safe), clamp nas margens, some quando atrás da câmera.
- **Barra de Energia** (`energyHud.ts`) — HUD flutuante sobre a nave mostrando o pool de Energia (`ENERGY atual/max` + barra de preenchimento). O mesmo padrão de projeção do `shipCoords`; atualizada a cada frame com `energy.current / energy.max`.
- **Painel de debug** (`debugControls.ts` + prancheta estática em `index.html`) — coluna direita, organizado em **abas navegáveis** (Cam · Ship · Follow Box · Parallax · **Weapons**): header fixo com readouts ao vivo de posição (nave/câmera) e rodapé com botão **Reset**. Sliders/spins/vectors editam os **objetos compartilhados** do jogo (source of truth única) e são sincronizados em duas vias: editar o HTML aplica no jogo (`applyCamera`/`applyShip`/`applyParallax`, ~15Hz via `sync()`, pulando o controle sob foco/drag do usuário).
- **Aba Weapons** — seletor da **arma ativa** da nave (laser/plasma/beam/mjolnir; troca pelo seletor ou tecla `F`), modificadores de arma (dano x, cadência x, Energia x, crit, pulsos, AoE, largura de feixe, cone) e o pool de **Energia** (max/regen). Os `mods` alimentam o `firing.ts` sem tocar no código das armas.
- **Legenda de controles** — coluna esquerda, estática em `index.html`.

### Input (`src/core/input.ts`)
- Estado central de teclas com `preventDefault` na lista controlada; `blur` limpa o estado.
- **Combinações Shift+Key**: quando Shift (esquerdo ou direito) está pressionado, gera códigos sintéticos `Shift+KeyX` (ex.: `Shift+KeyI`). Isso permite mapear rotações da câmera em Shift+IJKL/UO sem conflitar com movimento da câmera (IJKL/UO sozinhos).

### Weapons (arquitetura modular de armas)
- **`core/weaponsCatalog.ts`** — `WeaponConfig` tipado + catálogo `WEAPONS` (Laser, Plasma, Beam, Mjolnir), dados puros importados pelo `BALANCE`. Cada arma declara perfil (`projectile`/`orb`/`beam`/`cone`), dano, cadência, custo de Energia, pool size e espec de projétil/feixe/cone.
- **`weapons/behaviour.ts`** — interface Strategy (`WeaponBehaviour`), `WeaponServices` (Energia + alvos), `WeaponModifiers` e `defaultModifiers()`.
- **`weapons/weapon.ts`** — GameObject dispositivo: cria o pool próprio e delega para o behaviour do registry.
- **`weapons/registry.ts`** — `Record<WeaponId, factory>` — *seam de DLC*: adicionar arma = 1 entrada no catálogo + 1 no registry (+ `registerWeapon`).
- **`weapons/behaviours/{laser,plasma,beam,mjolnir}.ts`** — as 4 armas. Laser/Plasma spawnam projéteis do pool; Beam/Mjolnir são visuais contínuos com hit-query por frame (dano por segundo).
- **`gameobjects/shot.ts`** (projétil pooled, dano com decay por distância), **`gameobjects/beam.ts`** / **`gameobjects/cone.ts`** (visuais), **`gameobjects/testTarget.ts`** (alvo de teste).
- **`systems/firing.ts`** — input → fogo, gate de Energia, troca cíclica/seletor de arma (`setActive`).
- **`systems/collisionSystem.ts`** — colisão projétil×alvo por camadas (com AoE no plasma) e registro de targets.
- **`systems/energy.ts`** — pool de Energia (`EnergyPort` + `EnergySystem`): `start`/`max`/`current` e `regenPerSec`; `spend()`/`canAfford()` são usados por todo disparo (e futuramente jets/dash). Barra visual em `systems/energyHud.ts`.

---

## Arquitetura

```
poc/
  index.html                      # shell flex: legend (esq) · #app (canvas) · #panel (dir) + prancheta de abas do debug
  src/
    main.ts                       # bootstrap, loop rAF (dt clamp), composição de sistemas, sync() throttled do painel
    style.css                     # layout portrait + neon theme + abas do painel
    core/
      balancer.ts                 # BALANCE: todos os números/settings
      input.ts                    # estado de teclado
      weaponsCatalog.ts           # WEAPONS: catálogo tipado das armas principais (Laser/Plasma/Beam/Mjolnir)
    gameobjects/
      cameraRig.ts                # PerspectiveCamera + applyConfig
      ship.ts                     # nave wireframe + thruster
      parallax.ts                 # 3 camadas parallax
      followBox.ts                # caixa dead-zone (LineLoop)
      gizmos.ts                   # eixos mundiais, grade, eixos da câmera
      shot.ts                     # projétil pooled (laser/plasma)
      beam.ts                     # visual de feixe contínuo (Beam)
      cone.ts                     # visual de cone perfurante (Mjolnir)
      testTarget.ts               # alvo de teste (valida colisão/dano)
    weapons/
      weapon.ts                   # dispositivo de arma (device): pool + behaviour
      behaviour.ts                # interface Strategy + WeaponServices/WeaponModifiers
      registry.ts                 # Record<WeaponId, factory> — seam de DLC
      behaviours/
        laser.ts                  # projéteis retos pooled, decay com distância
        plasma.ts                 # orbs lentos, AoE na colisão/expiração
        beam.ts                   # DPS contínuo por hit-query
        mjolnir.ts                # cone perfurante por hit-query
    systems/
      controllers.ts              # input -> movimento da nave (acel/tilt) + câmera
      followCamera.ts             # dead-zone follow (âncora = centro da caixa)
      shipCoords.ts               # label X/Y/Z sobre a nave
      energyHud.ts                # barra de Energia flutuante sobre a nave
      debugControls.ts            # painel de debug (abas, sliders/readouts/reset, sync bidirecional)
      firing.ts                   # disparo, gate de Energia, troca/seletor de arma
      collisionSystem.ts          # colisão projétil×alvo + AoE + registro de targets
      energy.ts                   # pool de Energia (EnergyPort)
```

Regra do projeto (docs POC §7): *GameObject* na forma `init → update(dt) → syncRender → dispose`; fábricas/functions, sem ECS; `BALANCE` como única fonte de números; zero alocação por frame em hot path.

---

## Onde mexer nos números

Tudo em `src/core/balancer.ts`:

| Bloco | O que controla |
|---|---|
| `layout.playfield` | Resolução base do canvas portrait |
| `controls.shipKeys / motion / tilt / camera` | Mapa de teclas, força (accel/decel/brake) + `maxSpeed`, bank (graus + ms) e move/rot speed da câmera |
| `gameplay` | Pool de **Energia** (start/max/regen) e teclas de **fire/switch** (Space/F) |
| `weapons.catalog` / `weapons.loadout` | Catálogo tipado (dados das 4 armas em `weaponsCatalog.ts`) e ordem de troca cíclica |
| `ship.transform / follow / followBox` | Posição inicial; follow box (halfX/halfZ), "bounce" suave na borda (`bounce.timeMs`) e auto-recenter suave ao parar (`recenter`: delay/still/accel/maxSpeed) em direção ao **Recenter Point** (`restLine.position`: X relativo ao centro, Z relativo à base `anchor.z + halfZ + z`); posição/estilo da caixa + linha de centro (`centerLine`) + marcador `restLine` (cor/opacidade, position/width/height) |
| `ship.visual` | Dimensões e cores wireframe da nave/thruster |
| `camera` | FOV, posição/rotação iniciais, near/far |
| `parallax.layers[]` | Por camada: contagem, velocidade/scroll das estrelas, `parallaxGain` (reação ao Δ da câmera), posição relativa à câmera e rotação da grade, tamanho (`gridSize`) e opacidade da grade (`gridOpacity`), profundidades de voo (`zNearWrap`/`zFar`) |
| `thruster` | Posição/dimensões do jato |

---

## Notas / estado

- Spike devida ao `phase-0-poc.md`: algumas features (label de coords, layout portrait, follow box) são **dev tools / previews** — sem requisito `*.spec.MD` locked.
- **Weapons**: arquitetura modular pronta (catálogo + registry + behaviours + firing + collision + energia). Alvos de teste (`testTarget.ts`) existem só para validar colisão/dano — inimigos/meteoros reais vêm nas próximas fases do `todo.md`.
- Sem áudio, colisão com inimigos/meteoros, HUD de jogo ou persistência ainda (fora de escopo desta fase).
- O GDD e o planejamento ficam em `.docs/` (git-ignored) — busque com `rg --no-ignore "#tag/..."`.