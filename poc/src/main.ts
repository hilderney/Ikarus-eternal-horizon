import * as THREE from 'three'
import './style.css'
import { BALANCE } from './core/balancer'
import { createCameraRig } from './gameobjects/cameraRig'
import { createParallaxLayer, type ParallaxLayer, type ParallaxLayerConfig } from './gameobjects/parallax'
import { createShip, type Ship, type ShipTransform } from './gameobjects/ship'
import { createGizmos } from './gameobjects/gizmos'
import { createFollowBox, type FollowBox } from './gameobjects/followBox'
import { createDebugControls, type ControlMode } from './systems/debugControls'
import { createInput } from './core/input'
import { updateCameraFromInput, updateCameraRotationFromInput } from './systems/cameraControls'
import { updateShipFromInput } from './systems/shipControls'
import { createFollowCamera } from './systems/followCamera'

const MAX_FRAME_DT = 0.05

const app = document.getElementById('app')
if (!app) throw new Error('#app container not found')

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x05040a)

const cameraConfig = {
  fov: BALANCE.camera.fov,
  position: { ...BALANCE.camera.position },
  rotation: { ...BALANCE.camera.rotation },
  near: BALANCE.camera.near,
  far: BALANCE.camera.far,
}
const rig = createCameraRig(cameraConfig, scene)
const camera = rig.camera

const shipTransform: ShipTransform = {
  position: { ...BALANCE.ship.transform.position },
  rotation: { ...BALANCE.ship.transform.rotation },
  scale: BALANCE.ship.transform.scale,
}
const ship: Ship = createShip(BALANCE.ship.visual, scene)
ship.applyTransform(shipTransform)

const parallaxConfigs: ParallaxLayerConfig[] = BALANCE.parallax.layers.map((layer) => ({ ...layer }))
const layers: ParallaxLayer[] = parallaxConfigs.map((config) => createParallaxLayer(config, scene))

const gizmos = createGizmos(scene, camera)
const followBoxPos = BALANCE.ship.followBox.position
const followBox: FollowBox = createFollowBox(
  {
    color: BALANCE.ship.followBox.color,
    opacity: BALANCE.ship.followBox.opacity,
    y: followBoxPos.y,
  },
  scene,
)
const input = createInput()

const cameraControl = {
  moveSpeed: BALANCE.camera.moveSpeed,
  rotSpeed: BALANCE.camera.rotSpeed,
  keys: {
    moveZPlus: 'KeyW',
    moveZMinus: 'KeyS',
    moveXMinus: 'KeyA',
    moveXPlus: 'KeyD',
    moveYPlus: 'KeyR',
    moveYMinus: 'KeyF',
    rotXPlus: 'KeyI',
    rotXMinus: 'KeyK',
    rotZPlus: 'KeyJ',
    rotZMinus: 'KeyL',
    rotYPlus: 'KeyY',
    rotYMinus: 'KeyH',
  },
}

const shipControl = {
  speed: BALANCE.ship.moveSpeed,
  keys: {
    moveXMinus: 'KeyA',
    moveXPlus: 'KeyD',
    moveZPlus: 'KeyS',
    moveZMinus: 'KeyW',
  },
}

const follow = createFollowCamera(BALANCE.ship.follow, followBoxPos)

const modeFlag = document.createElement('div')
modeFlag.className = 'mode-flag'
document.body.appendChild(modeFlag)

let mode: ControlMode = 'camera'

function setMode(next: ControlMode): void {
  mode = next
  modeFlag.textContent = `MODE: ${next.toUpperCase()} — TAB to switch`
  modeFlag.classList.toggle('flag-ship', next === 'ship')
  controlsHandle.setMode(mode)
}

const controlsHandle = createDebugControls({
  rig,
  camera: cameraConfig,
  ship,
  shipTransform,
  parallax: parallaxConfigs,
  parallaxApply: () => {
    layers.forEach((layer, i) => layer.applyConfig(parallaxConfigs[i]))
  },
  followBox: BALANCE.ship.followBox.position,
  mode: {
    get: () => mode,
    set: setMode,
  },
})

window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') {
    e.preventDefault()
    setMode(mode === 'camera' ? 'ship' : 'camera')
  }
})

function onResize(): void {
  const width = window.innerWidth
  const height = window.innerHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}
window.addEventListener('resize', onResize)
onResize()

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, MAX_FRAME_DT)
  last = now

  if (mode === 'ship') {
    updateShipFromInput(input, shipTransform, shipControl, dt)
    ship.applyTransform(shipTransform)
    follow.update(cameraConfig, shipTransform)
    updateCameraRotationFromInput(input, cameraConfig, cameraControl, dt)
  } else {
    updateCameraFromInput(input, cameraConfig, cameraControl, dt)
  }
  rig.applyConfig(cameraConfig)

  followBox.update(
    { x: followBoxPos.x, z: followBoxPos.z },
    BALANCE.ship.follow.halfX,
    BALANCE.ship.follow.halfZ,
  )
  followBox.setVisible(true)
  controlsHandle.updateReadout(shipTransform.position, cameraConfig.position)

  for (const layer of layers) layer.update(dt)
  ship.update(dt)
  gizmos.update()

  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
let last = performance.now()
requestAnimationFrame(frame)