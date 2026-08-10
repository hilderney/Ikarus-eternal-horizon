export interface InputState {
  keys: Set<string>
}

const CONTROLLED = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF',
  'KeyI', 'KeyJ', 'KeyK', 'KeyL', 'KeyY', 'KeyH',
  'Tab',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
])

export function createInput(): InputState {
  const state: InputState = { keys: new Set() }

  window.addEventListener('keydown', (e) => {
    if (CONTROLLED.has(e.code)) e.preventDefault()
    state.keys.add(e.code)
  })

  window.addEventListener('keyup', (e) => {
    state.keys.delete(e.code)
  })

  window.addEventListener('blur', () => {
    state.keys.clear()
  })

  return state
}

export function isDown(state: InputState, code: string): boolean {
  return state.keys.has(code)
}