import './style.css'
import { BALANCE } from './core/balancer'
import { InputState, buildPreventDefaultCodes } from './core/input'
import { createInputBindings } from './core/input-bindings'
import { GameLoop } from './core/loop'
import { GameCamera } from './gameobjects/camera/game-camera'
import { GameRenderer } from './render/renderer'
import { PauseScene } from './scenes/pause-scene'
import { RunScene } from './scenes/run-scene'
import { createInputMap, createRunWorld } from './scenes/run-world'
import { UiAreas } from './ui/areas'
import { TouchControls, createTouchPad } from './ui/touch-controls/touch-controls'

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
const bindings = createInputBindings()
const input = new InputState({
  preventDefaultCodes: buildPreventDefaultCodes(),
  touch,
  bindings,
})
const touchOverlay = new TouchControls({
  host: areas.game,
  source: touch,
  enabled: false,
  stickSize: BALANCE.controls.touch.stickSize,
  stickColor: BALANCE.controls.touch.stickColor,
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
    touchOverlay,
    host: areas.game,
    debuggerHost: areas.debugger,
    gameCamera,
    cameraConfig,
  }),
  input,
  inputMap: createInputMap(bindings, () => {
    touchOverlay.syncSlots(bindings.touch.slots)
  }),
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

const runtime: { loop: GameLoop | null } = { loop: null }

const pause = new PauseScene({
  host: areas.stage,
  loop: {
    setPaused(paused) {
      runtime.loop?.setPaused(paused)
    },
  },
  input,
  onSchemeChange(scheme) {
    touchOverlay.setVisible(scheme === 'touch')
  },
})

const loop = new GameLoop({
  step(dt) {
    run.update(dt)
    if (input.consumePress('pause')) {
      pause.mount()
    }
    run.syncRender()
  },
  sidecar() {
    if (loop.paused) {
      pause.poll()
    }
  },
})
runtime.loop = loop

loop.start()
