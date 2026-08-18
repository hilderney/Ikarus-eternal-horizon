import './style.css'
import { BALANCE } from './core/balancer'
import { InputState, buildPreventDefaultCodes } from './core/input'
import { GameLoop } from './core/loop'
import { GameCamera } from './gameobjects/camera/game-camera'
import { GameRenderer } from './render/renderer'
import { RunScene } from './scenes/run-scene'
import { createInputMap, createRunWorld } from './scenes/run-world'
import { UiAreas } from './ui/areas'
import { createTouchPad } from './ui/touch-controls/touch-controls'

const playfield = BALANCE.layout.playfield
const cameraConfig = {
  fov: BALANCE.camera.fov,
  position: { ...BALANCE.camera.position },
  rotation: { ...BALANCE.camera.rotation },
  near: BALANCE.camera.near,
  far: BALANCE.camera.far,
  aspect: playfield.width / playfield.height,
}
const gameCamera = new GameCamera(cameraConfig)
const areas = new UiAreas()
const renderer = new GameRenderer({ camera: gameCamera })
const touch = createTouchPad()
const input = new InputState({
  preventDefaultCodes: buildPreventDefaultCodes(),
  touch,
})

const run = new RunScene({
  areas,
  renderer,
  router: {
    next() {
      /* G01 / G04 — Result not wired yet */
    },
  },
  world: createRunWorld({
    scene: renderer.scene,
    input,
    touch,
    host: areas.game,
    gameCamera,
    cameraConfig,
  }),
  input,
  inputMap: createInputMap(),
  createResult: () => ({
    id: 'result',
    mount() {
      /* G04 */
    },
    update() {
      /* G04 */
    },
    syncRender() {
      /* G04 */
    },
    dispose() {
      /* G04 */
    },
  }),
})

run.mount()

const loop = new GameLoop({
  step(dt) {
    run.update(dt)
    run.syncRender()
  },
})
loop.start()
