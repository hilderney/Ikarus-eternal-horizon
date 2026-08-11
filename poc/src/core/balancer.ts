export interface Vec3Params {
  x: number
  y: number
  z: number
}

export const BALANCE = {
  layout: {
    playfield: { width: 540, height: 960 },
  },
  ship: {
    transform: {
      position: { x: -2, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
    },
    moveSpeed: 1,
    follow: {
      halfX: 5,
      halfZ: 5,
    },
    followBox: {
      position: { x: 2, y: 0, z: 0 },
      color: 0xf0ab4a,
      opacity: 0.55,
    },
    visual: {
      size: { w: 2, h: 1, d: 1.4 },
      wireframeColor: 0x22d3ee,
      accentColor: 0x6d28d9,
      thrusterColor: 0x60c5ff,
    },
  },
  camera: {
    fov: 85,
    position: { x: 4  , y: 11, z: 6 },
    rotation: { x: -55, y: 24, z: -14},
    near: 5.00,
    far: 5000,
    moveSpeed: 12,
    rotSpeed: 45,
  },
  parallax: {
    layers: [
      {
        name: 'stars',
        count: 600,
        speed: 0.5,
        speedJitter: 0.5,
        size: 1,
        color: 0xa5e8ff,
        alpha: 1.0,
        xSpan: 6000,
        layerY: -500,
        zNearWrap: 60,
        zFar: -4000,
        gridSize: 200,
        gridColor: 0x555555,
        gridOpacity: 0.0,
      },
      {
        name: 'debris',
        count: 500,
        speed: 0.5,
        speedJitter: 0.45,
        size: 1,
        color: 0xd97706,
        alpha: 0.5,
        xSpan: 4800,
        layerY: -400,
        zNearWrap: 60,
        zFar: -3800,
        gridSize: 200,
        gridColor: 0x555555,
        gridOpacity: 0.0,
      },
      {
        name: 'mesh',
        count: 600,
        speed: 0.5,
        speedJitter: 0.4,
        size: 1,
        color: 0x7c68ff,
        alpha: 0.25,
        xSpan: 4500,
        layerY: -350,
        zNearWrap: 60,
        zFar: -3500,
        gridSize: 200,
        gridColor: 0x555555,
        gridOpacity: 0.0,
      },
    ],
  },
  thruster: {
    position: { y: -0.55 },
    length: 0.5,
    width: 0.3,
  },
}