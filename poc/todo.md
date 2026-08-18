# POC TODO LIST

> Roteiro de desenvolvimento em ordem. Objetivo: fechar um jogo jogável publicável no Itch.io.
> Metal→gameplay: movimentação e parallax já prontos. A ordem abaixo constrói o loop de combate e as telas em sequência de dependência.

---

## Fase 0 — Base pronta (concluído)

- [x] limitBox faz a câmera seguir a nave
- [x] tilt da nave na movimentação
- [x] movimentação da nave suave como força aplicada
- [x] grids de parallax com posição fixa à posição da câmera
- [x] movimentação da câmera faz deslocamento nos jitters das gridbox (ajuda na sensação de movimento e profundidade)
- [x] ajustar movimento suave da câmera de seguir o limitBox; quando sem movimento da nave aproximar lentamente a câmera colocando a nave na linha central (eixo z do limit box calcula a distância)

---



## Fase 1 — Disparos e sistema de dano (HP + Shield)

- [x] Criar GameObject de disparos laser, saindo da ponta da frente da nave
- [x] Disparos devem perder força com distância e sumir também
- [ ] Ajustar frequência e velocidades de disparos
- [ ] Criar Hitbox da nave (camada `player`)
- [ ] Criar Hitbox do laser (camada `shots`)
- [ ] Motor de colisão 2D por camadas (`player` / `shots` / `meteors` / `enemy` / `drops`) — AABB/círculo, pool, zero alocação por frame
- [ ] Sistema de dano: **Campo de Força (shield)** absorve primeiro; quando zera, dano vai para **Integridade (HP)**
- [ ] Regeneração lenta do Shield após não levar dano por um tempo
- [ ] Feedback de dano: flash na nave, shake, som diferenciado de shield vs hull

---



## Fase 2 — Meteoros

- [ ] Criar áreas de spawn de meteoros (bordas do playfield)
- [ ] Criar GameObjects dos meteoros (tamanhos pequeno/médio/grande)
- [ ] Criar Hitbox do meteoro (camada `meteors`)
- [ ] Acerto de laser retira HP do meteoro de acordo com a força/disparo
- [ ] Destruição de instância de gameobject meteoro
- [ ] Animação simples de destruição de meteoro (explosão wireframe/partículas pooled)
- [ ] Acerto de meteoro no player retira HP/shield do player
- [ ] Meteoros grandes quebram em fragmentos menores ao serem atingidos



## Fase 3 — Drop de recursos

- [ ] Criar sistema de drop ao destruir meteoros (Metal Scrap, Prismatic Crystal, Dense Core)
- [ ] GameObject dos drops (camada `drops`) com magnet radius de coleta
- [ ] Coleta adiciona recurso ao inventário (contagem)
- [ ] Som de coleta por tipo de recurso

---



## Fase 4 — Inimigos (guerreiro/pré-Bestiário)

- [ ] Criar áreas de spawn de naves inimigas (duas laterais à frente do playfield)
- [ ] Criar GameObject do Warrior (nave inimiga básica)
- [ ] Definir movimentação estratégica do Warrior (entrada, aproximação, ataque, recuo)
- [ ] Criar Hitbox do Warrior (camada `enemy`)
- [ ] Acerto de laser retira HP do Warrior de acordo com a força/disparo
- [ ] Destruição de instância de gameobject Warrior
- [ ] Animação simples de destruição do Warrior
- [ ] Acerto do Warrior (tocar nela ou tiro dela) no player retira HP/shield do player
- [ ] Tiro inimigo básico (projétil da nave inimiga, camada `enemy_shots`)
- [ ] Drop de recursos ao destruir Warrior



## Fase 5 — Degradação por Integridade

- [ ] Estado da Integridade da nave impactar o **deslocamento** (agilidade/velocidade) conforme o dano
- [ ] Estado da Integridade impactar a **cadência de disparos** conforme o dano
- [ ] Definir patamares de integridade (ex.: 100%–75% normal, 75%–50% leve, 50%–25% pesado, <25% crítico) com penalidades legíveis no HUD

---



## Fase 6 — Armas variadas

- [ ] **Plasma** — orbs lentos com dano em área (AoE)
- [ ] **Beam (laser contínuo)** — DPS contínuo e escalonado enquanto segura o disparo
- [ ] **Thunder/Mjolnir** — cone elétrico perfurante
- [ ] Troca de arma ativa e diferença de cadência/custo de Energia por arma



## Fase 7 — Bomba (Special Ordnance)

- [ ] Bomba que causa efeito na tela: onda expansiva que destrói/some projéteis inimigos e causa dano em área
- [ ] Cargas limitadas de bomba (Nova Bomb) exibidas no HUD
- [ ] Efeito de tela: flash/shockwave, shake, hit-stop
- [ ] Ganho de cargas via drop ou coleta de recurso

---



## Fase 8 — Equipamentos

- [ ] **Quantum Deflectors** — aumenta capacidade do Shield
- [ ] **Gravity Assist Engine** — aumenta velocidade/agilidade de deslocamento
- [ ] Sistema de equipar/instalar equipamento (slot no inventário)
- [ ] Efeitos aplicados de forma cumulativa aos atributos da nave



## Fase 9 — HUD do jogo

- [ ] Barras de Shield, Integridade e Energia (flutuantes junto à nave ou fixas)
- [ ] Score e contagem de kills
- [ ] Cargas de bomba e arma ativa
- [ ] Contador de recursos coletados

---



## Fase 10 — Pausa com inventário

- [ ] Tela de Pausa (Esc) pausando o jogo
- [ ] Inventário: lista de recursos coletados
- [ ] Equipamentos instalados + troca/instalação
- [ ] Reload/restart e voltar ao jogo



## Fase 11 — Tela inicial

- [ ] Tela inicial com título e botões (Jogar / Loja / Ranking)
- [ ] Estado de máquina de telas (menu → jogo → pause → fim de run → menu)



## Fase 12 — Loja

- [ ] Loja acessível pela tela inicial
- [ ] Troca de recursos coletados por equipamentos, armas e bombas
- [ ] Persistência local (localStorage) de créditos/recursos/meta entre runs



## Fase 13 — Pontuação e ranking

- [ ] Pontuação cumulativa por kills/meteoros/eventos
- [ ] Recording de pontuação pessoal (best score local)
- [ ] Tela de ranking de pontos estilo arcade (tabela com as maiores pontuações locais)

---



## Fase 14 — Fechamento / [Itch.io](http://Itch.io)

- [ ] Refatorar código otimizando eficiência e legibilidade, com separação de responsabilidades e modularidade (criar motores lógicos que analisam cada evento do jogo)
- [ ] Tudo parametrizável em `src/core/balancer.ts` (números fora do código de gameplay)
- [ ] Packaging web: `index.html` na raiz, paths relativos, canvas responsivo
- [ ] Fim de run: tela de Game Over com score, restart e retorno ao menu
- [ ] Teste de sessão de 3–8 min sem bugs e sem queda de frames (pooling em todo hot path)

---



## Extras / dev tools (opcional, não bloqueiam)

- [ ] Criar área de escuridão (objetos na mesma layer que o player aparecem a partir de distância Z)
- [ ] Criar tags para debug na tela por assunto (nave, limitBox e movimentos, câmera, grids parallax)
- [ ] Ajustar tamanho dos inputs no debugger
- [ ] Vincular valores reais dentro do debugger em tempo real