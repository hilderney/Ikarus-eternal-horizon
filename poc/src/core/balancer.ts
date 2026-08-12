export interface Vec3Params {
  x: number
  y: number
  z: number
}

export const BALANCE = {
  layout: {
    playfield: { width: 540, height: 960 },
  },
  controls: {
    shipKeys: {
      moveXMinus: 'KeyA',
      moveXPlus: 'KeyD',
      moveZMinus: 'KeyW',
      moveZPlus: 'KeyS',
    },
    motion: {
      maxSpeed: 12,
      accel: 60,
      decel: 60,
      brake: 120,
    },
    tilt: {
      axis: 'z' as 'y' | 'z',
      sign: -1 as 1 | -1,
      maxDeg: 22,
      riseMs: 150,
      fallMs: 200,
    },
    camera: {
      moveSpeed: 12,
      rotSpeed: 45,
      keys: {
        moveZPlus: 'KeyI',
        moveZMinus: 'KeyK',
        moveXMinus: 'KeyJ',
        moveXPlus: 'KeyL',
        moveYPlus: 'KeyU',
        moveYMinus: 'KeyO',
        rotXPlus: ['Numpad8', 'Digit8'],
        rotXMinus: ['Numpad2', 'Digit2'],
        rotZPlus: ['Numpad7', 'Digit7'],
        rotZMinus: ['Numpad9', 'Digit9'],
        rotYPlus: ['Numpad4', 'Digit4'],
        rotYMinus: ['Numpad6', 'Digit6'],
      },
    },
  },
  ship: {
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
    },
    follow: {
      halfX: 6,
      halfZ: 8,
    },
    followBox: {
      position: { x: 0, y: 0, z: -3 },
      color: 0xf0ab4a,
      opacity: 0.55,
    },
    visual: {
      size: { w: 1.5, h: 1, d: 2 },
      wireframeColor: 0x22d3ee,
      accentColor: 0x6d28d9,
      thrusterColor: 0x60c5ff,
    },
  },
  // camera: {
  //   fov: 85,
  //   position: { x: 0  , y: 100, z: 0 },
  //   rotation: { x: -90, y: 0, z: 0},
  //   near: 1.00,
  //   far: 10000,
  // },
  camera: {
    fov: 85,
    position: { x: 2.7  , y: 12, z: 6 },
    rotation: { x: -55, y: 24, z: -14},
    near: 5.00,
    far: 10000,
  },
  parallax: {
    layers: [
      {
name: 'background_stars',
        count: 400,
        speed: 5,
        speedJitter: 0.5,
        parallaxGain: 0.15,
        size: 1,
        color: 0xa5e8ff, // white
        alpha: 0.5,
        position: { x: 0, y: -300, z: 100 },
        rotation: { x: 0, y: 0, z: 0 },
        gridSize: 1000,
        gridColor: 0x555555,
        gridOpacity: 0,
        zNearWrap: 0,
        zFar: -2000,
      },
      {
name: 'solar_system',
        count: 300,
        speed: 5,
        speedJitter: 0.5,
        parallaxGain: 0.15,
        size: 1,
        color: 0xd97706, // red
        alpha: 0.5,
        position: { x: 0, y: -800, z: 100 },
        rotation: { x: 0, y: 0, z: 0 },
        gridSize: 2000,
        gridColor: 0x555555,
        gridOpacity: 0.0,
        zNearWrap: 0,
        zFar: -2500,
      },
      {
name: 'debris',
        count: 150,
        speed: 5,
        speedJitter: 0.5,
        parallaxGain: 0.15,
        size: 1,
        color: 0x7c68ff, // yellow
        alpha: 0.5,
        position: { x: 0, y: -3000, z: 300 },
        rotation: { x: 0, y: 0, z: 0 },
        gridSize: 7000,
        gridColor: 0x555555,
        gridOpacity: 0.0,
        zNearWrap: 0,
        zFar: -10000,
      },
    ],
  },
  thruster: {
    position: { y: -0.55 },
    length: 0.5,
    width: 0.3,
  },
}