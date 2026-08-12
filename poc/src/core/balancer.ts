export interface Vec3Params {
  x: number
  y: number
  z: number
}

const parallaxGain = 0.015

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
        rotXPlus: 'Shift+KeyK',
        rotXMinus: 'Shift+KeyI',
        rotZPlus: 'Shift+KeyU',
        rotZMinus: 'Shift+KeyO',
        rotYPlus: 'Shift+KeyJ',
        rotYMinus: 'Shift+KeyL',
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
      bounce: {
        timeMs: 500,
      },
      recenter: {
        delayMs: 1500,
        stillMs: 800,
        accel: 3,
        maxSpeed: 12,
      },
    },
    followBox: {
      position: { x: 0, y: 0, z: -3 },
      color: 0xf0ab4a,
      opacity: 0.35,
      centerLine: {
        color: 0x50e3c2,
        opacity: 0.8,
      },
      restLine: {
        // Recenter Point: alvo fixo relativo ao box. position.z é medido a partir
        // da BORDA DA BASE (anchor.z + halfZ + position.z); position.x relativo ao centro X.
        color: 0x2d6bff,
        opacity: 0.9,
        position: { x: 0, y: 0, z: -1 },
        width: 2,
        height: 4,
      },
    },
    visual: {
      size: { w: 1.5, h: 1, d: 2 },
      wireframeColor: 0x22d3ee,
      accentColor: 0x6d28d9,
      thrusterColor: 0x60c5ff,
    },
  },
  camera: {
    // COCKPIT VIEW
    /* fov: 120,
    position: { x: 0, y: 0, z: -6 },
    rotation: { x: 0, y: 0, z: 0 },
    near: 10.00,
    far: 10000, */
    
    // TOP VIEW
    /* fov: 85,
    position: { x: 0, y: 100, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    near: 1.00,
    far: 10000, */
    
    // DYNAMIC VIEW
    fov: 85,
    position: { x: 2.7, y: 12, z: 6 },
    rotation: { x: -55, y: 24, z: -14 },
    near: 5.00,
    far: 10000,
  },

  parallax: {
    //COCKPIT VIEW
    /* layers: [
      {
        name: 'background_stars',
        count: 400,
        speed: (0.2 * 10),
        speedJitter: 0.5,
        parallaxGain: (0.015 * 10),
        size: 1,
        color: 0xa5e8ff, // white
        alpha: 0.5,
        position: { x: 0, y: -150, z: 300 },
        rotation: { x: 38, y: 0, z: 15 },
        gridSize: 1000,
        gridColor: 0x555555,
        gridOpacity: 0,
        zNearWrap: 0,
        zFar: -2000,
      },
      {
        name: 'solar_system',
        count: 300,
        speed: (0.2 * 6),
        speedJitter: 0.5,
        parallaxGain: (0.015 * 6),
        size: 1,
        color: 0xd97706, // red
        alpha: 0.5,
        position: { x: 0, y: -100, z: 200 },
        rotation: { x: 38, y: 0, z: -15 },
        gridSize: 1000,
        gridColor: 0x555555,
        gridOpacity: 0.0,
        zNearWrap: 0,
        zFar: -2000,
      },
      {
        name: 'debris',
        count: 150,
        speed: (0.2 * 2),
        speedJitter: 0.5,
        parallaxGain: (0.015 * 2),
        size: 1,
        color: 0x7c68ff, // yellow
        alpha: 0.5,
        position: { x: 0, y: -50, z: 100 },
        rotation: { x: 38, y: 0, z: 0 },
        gridSize: 1000,
        gridColor: 0x555555,
        gridOpacity: 0.0,
        zNearWrap: 0,
        zFar: -2000,
      },
    ], */

    //TOP VIEW
    /* layers: [
      {
        name: 'background_stars',
        count: 400,
        speed: (0.05 * 10),
        speedJitter: 0.5,
        parallaxGain: (0.015 * 10),
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
        speed: (0.05 * 6),
        speedJitter: 0.5,
        parallaxGain: (0.015 * 6),
        size: 1,
        color: 0xd97706, // red
        alpha: 0.5,
        position: { x: 0, y: -350, z: 100 },
        rotation: { x: 0, y: 0, z: 0 },
        gridSize: 1000,
        gridColor: 0x555555,
        gridOpacity: 0.0,
        zNearWrap: 0,
        zFar: -2000,
      },
      {
        name: 'debris',
        count: 150,
        speed: (0.05 * 2),
        speedJitter: 0.5,
        parallaxGain: (0.015 * 2),
        size: 1,
        color: 0x7c68ff, // yellow
        alpha: 0.5,
        position: { x: 0, y: -400, z: 100 },
        rotation: { x: 0, y: 0, z: 0 },
        gridSize: 1000,
        gridColor: 0x555555,
        gridOpacity: 0.0,
        zNearWrap: 0,
        zFar: -2000,
      },
    ], */

    //DYNAMIC VIEW
    layers: [
      {
        name: 'background_stars',
        count: 400,
        speed: (0.2 * parallaxGain),
        speedJitter: 0.5,
        parallaxGain: (0.015 * parallaxGain),
        size: 1,
        color: 0xa5e8ff, // white
        alpha: 0.5,
        position: { x: 0, y: -600, z: 100 },
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
        speed: (0.2 * 15),
        speedJitter: 0.5,
        parallaxGain: (0.015 * 15),
        size: 1,
        color: 0xd97706, // red
        alpha: 0.5,
        position: { x: 0, y: -300, z: 100 },
        rotation: { x: 0, y: 0, z: 0 },
        gridSize: 1000,
        gridColor: 0x555555,
        gridOpacity: 0.0,
        zNearWrap: 0,
        zFar: -2000,
      },
      {
        name: 'debris',
        count: 150,
        speed: (0.2 * 20),
        speedJitter: 0.5,
        parallaxGain: (0.015 * 20),
        size: 1,
        color: 0x7c68ff, // yellow
        alpha: 0.5,
        position: { x: 0, y: -150, z: 100 },
        rotation: { x: 0, y: 0, z: 0 },
        gridSize: 1000,
        gridColor: 0x555555,
        gridOpacity: 0.0,
        zNearWrap: 0,
        zFar: -2000,
      },
    ],
  },

  thruster: {
    position: { y: -0.55 },
    length: 0.5,
    width: 0.3,
  },
}