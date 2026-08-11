import * as THREE from 'three'
import './style.css'
import { BALANCE } from './core/balancer'
import { createCameraRig } from './gameobjects/cameraRig'
import { createParallaxLayer, type ParallaxLayer, type ParallaxLayerConfig } from './gameobjects/parallax'
import { createShip, type Ship, type ShipTransform } from './gameobjects/ship'
import { createGizmos } from './gameobjects/gizmos'
import { createFollowBox, type FollowBox } from './gameobjects/followBox'
import { createDebugControls } from './systems/debugControls'
import { createInput } from './core/input'
import { updateCameraFromInput } from './systems/cameraControls'
import { updateShipFromInput } from './systems/shipControls'
import { createFollowCamera } from './systems/followCamera'
import { createShipPositionLabel } from './systems/shipCoords'

const MAX_FRAME_DT = 0.05

const app = document.getElementById('app')
if (!app) throw new Error('#app container not found')

const panel = document.getElementById('panel')
if (!panel) throw new Error('#panel container not found')

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(BALANCE.layout.playfield.width, BALANCE.layout.playfield.height, false)
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
camera.aspect = BALANCE.layout.playfield.width / BALANCE.layout.playfield.height
camera.updateProjectionMatrix()

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
const shipCoords = createShipPositionLabel(camera, renderer.domElement)

const cameraControl = {
  moveSpeed: BALANCE.camera.moveSpeed,
  rotSpeed: BALANCE.camera.rotSpeed,
  keys: {
    moveZPlus: 'KeyI',
    moveZMinus: 'KeyK',
    moveXMinus: 'KeyJ',
    moveXPlus: 'KeyL',
    moveYPlus: 'KeyR',
    moveYMinus: 'KeyF',
    rotXPlus: ['Numpad8', 'Digit8'],
    rotXMinus: ['Numpad2', 'Digit2'],
    rotZPlus: ['Numpad7', 'Digit7'],
    rotZMinus: ['Numpad9', 'Digit9'],
    rotYPlus: ['Numpad4', 'Digit4'],
    rotYMinus: ['Numpad6', 'Digit6'],
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
  follow: BALANCE.ship.follow,
}, panel)

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, MAX_FRAME_DT)
  last = now

  updateShipFromInput(input, shipTransform, shipControl, dt)
  ship.applyTransform(shipTransform)
  updateCameraFromInput(input, cameraConfig, cameraControl, dt)
  follow.update(cameraConfig, shipTransform)
  rig.applyConfig(cameraConfig)

  followBox.update(
    { x: followBoxPos.x, z: followBoxPos.z },
    BALANCE.ship.follow.halfX,
    BALANCE.ship.follow.halfZ,
  )
  followBox.setVisible(true)
  shipCoords.update(shipTransform.position)
  controlsHandle.updateReadout(shipTransform.position, cameraConfig.position)

  for (const layer of layers) layer.update(dt)
  ship.update(dt)
  gizmos.update()

  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
let last = performance.now()
requestAnimationFrame(frame)