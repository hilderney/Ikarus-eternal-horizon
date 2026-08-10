export interface Vec3Params {
  x: number
  y: number
  z: number
}

export const BALANCE = {
  ship: {
    transform: {
      position: { x: 2, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
    },
    moveSpeed: 12,
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
      size: { w: 2.2, h: 0.9, d: 1.4 },
      wireframeColor: 0x22d3ee,
      accentColor: 0x6d28d9,
      thrusterColor: 0x60c5ff,
    },
  },
  camera: {
    fov: 60,
    position: { x: 10, y: 15, z: 10 },
    rotation: { x: -45, y: 15, z: 0 },
    near: 0.01,
    far: 920,
    moveSpeed: 12,
    rotSpeed: 45,
  },
  parallax: {
    layers: [
      {
        name: 'stars',
        count: 450,
        speed: 0.1,
        speedJitter: 0.5,
        size: 0.5,
        color: 0xa5e8ff,
        alpha: 1.0,
        xSpan: 150,
        layerY: -15,
        zNearWrap: 60,
        zFar: -130,
        gridSize: 200,
        gridColor: 0x555555,
        gridOpacity: 0.07,
      },
      {
        name: 'debris',
        count: 220,
        speed: 0.3,
        speedJitter: 0.45,
        size: 0.5,
        color: 0xd97706,
        alpha: 0.5,
        xSpan: 150,
        layerY: -10,
        zNearWrap: 60,
        zFar: -110,
        gridSize: 200,
        gridColor: 0x555555,
        gridOpacity: 0.06,
      },
      {
        name: 'mesh',
        count: 130,
        speed: 0.7,
        speedJitter: 0.4,
        size: 0.5,
        color: 0x7c68ff,
        alpha: 0.25,
        xSpan: 150,
        layerY: -5,
        zNearWrap: 60,
        zFar: -95,
        gridSize: 200,
        gridColor: 0x555555,
        gridOpacity: 0.05,
      },
    ],
  },
  thruster: {
    position: { y: -0.55 },
    length: 0.5,
    width: 0.3,
  },
}