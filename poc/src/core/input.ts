export interface InputState {
  keys: Set<string>
}

const CONTROLLED = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'Space', 'KeyC',
  'KeyI', 'KeyJ', 'KeyK', 'KeyL', 'KeyM', 'KeyN', 'KeyO', 'KeyU',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight',
])

export function createInput(): InputState {
  const state: InputState = { keys: new Set() }
  let shiftPressed = false

  window.addEventListener('keydown', (e) => {
    if (CONTROLLED.has(e.code)) e.preventDefault()
    state.keys.add(e.code)

    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      shiftPressed = true
    } else if (shiftPressed) {
      state.keys.add('Shift+' + e.code)
    }
  })

  window.addEventListener('keyup', (e) => {
    state.keys.delete(e.code)
    state.keys.delete('Shift+' + e.code)

    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      shiftPressed = false
    }
  })

  window.addEventListener('blur', () => {
    state.keys.clear()
    shiftPressed = false
  })

  return state
}

export function isDown(state: InputState, code: string): boolean {
  return state.keys.has(code)
}