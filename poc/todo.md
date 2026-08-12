- limitBox faz a camera seguir a nave
- tilt da nave na movimentação
- movimentação da nave suave como força aplicada
- grids de paralax com posição fixa a posição da camera
- movimentação da camera faz dfeslocamento nos jitters das gridbox (ajuda na sensação de movimento e profundidade)
- Ajustar movimento suave da camera de seguir o limitBox, quando sem movimento da nave aproximar lentamente a camera colocando a nave na linha central (eixo z do limit box calcula a distancia)
- Criar GameObject de disparos laser, saindo da ponta da frente da nave.
- Disparos devem perder força com distancia e sumir tb
- Ajustar frequencia e velocidades de disparos



- Criar área de escuridão (objetos na mesma layer que o player aparecem a partir de distancia Z)
- Criar tags para debug na tela por assunto (nave limitBox e movimentos, camera, grids parallax).
- Ajustar tamanho dos inputs no debugger
- Vincular valores reais dentro do debugger Real Time
- Tudo parametrizavel pára debugger.



- Criar Hitbox da nave (camada player)
- Criar Hitbox do laser (camada shots)
- Criar Áreas de spawn de meteoros
- Criar GameObjects dos meteoros
- Criar Hitbox do meteoro (camada meteors)
- acerto de laser retira HP do meteoro de acordo com força
- destruição de instancia de gameobject meteoro.
- animação simples de destruição de meteoro.
- acerto de meteoro no player retira HP do player.



- Criar HUD do jogo  
  

- Refatorar código otimizando eficiencia e legibilidade, com separação de responsabilidades e modularidade. (criar motores lógicos que analisam cada evento do jogo).

