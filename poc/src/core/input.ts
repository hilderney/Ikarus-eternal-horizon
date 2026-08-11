export interface InputState {
  keys: Set<string>
}

const CONTROLLED = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF',
  'KeyI', 'KeyJ', 'KeyK', 'KeyL',
  'Numpad2', 'Numpad4', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9',
  'Digit2', 'Digit4', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
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