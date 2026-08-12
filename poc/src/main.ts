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
import { createControllers } from './systems/controllers'
import { createFollowCamera } from './systems/followCamera'
import { createShipPositionLabel } from './systems/shipCoords'

const MAX_FRAME_DT = 0.05
const SYNC_INTERVAL = 0.066

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
    centerLine: BALANCE.ship.followBox.centerLine,
    restLine: BALANCE.ship.followBox.restLine,
  },
  scene,
)
const input = createInput()
const shipCoords = createShipPositionLabel(camera, renderer.domElement)

const controllers = createControllers(
  {
    shipKeys: BALANCE.controls.shipKeys,
    motion: BALANCE.controls.motion,
    tilt: BALANCE.controls.tilt,
    camera: BALANCE.controls.camera,
  },
  shipTransform,
  cameraConfig,
  input,
)

const follow = createFollowCamera(
  BALANCE.ship.follow,
  followBoxPos,
  BALANCE.ship.followBox.restLine.position,
)

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
  recenterPoint: BALANCE.ship.followBox.restLine,
  controls: BALANCE.controls,
}, panel)

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, MAX_FRAME_DT)
  last = now

  controllers.update(dt)
  ship.applyTransform(shipTransform)
  follow.update(cameraConfig, shipTransform, dt)
  rig.applyConfig(cameraConfig)

  followBox.update(
    { x: followBoxPos.x, z: followBoxPos.z },
    BALANCE.ship.follow.halfX,
    BALANCE.ship.follow.halfZ,
  )
  followBox.setVisible(true)
  shipCoords.update(shipTransform.position)
  controlsHandle.updateReadout(shipTransform.position, cameraConfig.position)
  syncAcc += dt
  if (syncAcc >= SYNC_INTERVAL) {
    syncAcc = 0
    controlsHandle.sync()
  }

  for (const layer of layers) layer.update(dt, camera)
  ship.update(dt)
  gizmos.update()

  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
let last = performance.now()
let syncAcc = 0
requestAnimationFrame(frame)