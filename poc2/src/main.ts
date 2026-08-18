import './style.css'

/*
 * POC2 bootstrap — walking skeleton.
 *
 * Deliberately free of gameplay. The renderer, the game loop and the scene flow
 * arrive with SDD-G09, SDD-A04 and SDD-G01/SDD-G03; this entry point only asserts
 * that the three structural areas exist and keeps `npm run dev` / `npm run build`
 * green from the first commit.
 *
 * Build order and cards: .docs/plans/planning.spec.MD §5
 */

const AREA_IDS = ['area-inputs', 'game-area', 'debugger-area'] as const

function requireArea(id: string): HTMLElement {
  const element = document.getElementById(id)
  if (element === null) {
    throw new Error(`Missing structural area #${id} in index.html (see phase-0-poc2.md §4.2)`)
  }
  return element
}

function bootstrap(): void {
  const areas = AREA_IDS.map(requireArea)
  const gameArea = areas[1]

  const status = document.createElement('p')
  status.className = 'scaffold-status'
  status.textContent = 'POC2 — SDD-A01 Balancer live. Next: A03 Math / A05 ObjectPool. See poc2/todo.md.'
  gameArea.append(status)
}

bootstrap()
