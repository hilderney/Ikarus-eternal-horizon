/**
 * #tag/arch #tag/persistence #tag/memory #tag/offline-first
 *
 * Card:         SDD-F06 DataPersistence
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL-06, SHIP-06, RES-05
 * Change type:  new
 * POC-1 origin: none (new)  — POC-1 had no persistence layer
 * Test file:    poc2/src/systems/persistence.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      `PersistenceManager` + `SyncController` — the hybrid persistence layer.
 *            Serialises the complete player state (modular ship, inventory, rankings,
 *            run state) to JSON. Writes/reads IndexedDB (local, offline-first, sub-50 ms)
 *            and syncs to MongoDB Atlas (cloud) on explicit triggers: end-of-run,
 *            manual save, checkpoint. Exposes a single `PersistencePort` the game consumes.
 *            Conflict resolution: latest `updatedAt` wins; tie → local wins.
 *            Schema versioning with migration scripts for `localDBVersion` upgrades.
 * Does not own: gameplay logic, render, input, scene management, network transport
 *            beyond the `CloudAdapter` fetch wrapper. Auth is delegated to the adapter
 *            (anonymous device-id fallback + optional email/social).
 * Player-facing: save/load is instant and invisible during play; cloud sync runs in
 *            background after a run ends; a toast confirms sync status. No "save slots" UI.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer           — BALANCE.persistence (new section), BALANCE.ship.stats
 *   SDD-C01 Ship               — ShipDebugPort (pose, stats, status, loadout), Inventory
 *   SDD-G10 RunState           — runState (score, kills, wave, seed, startedAt, endedAt)
 *   SDD-G05 RankingsScene      — rankings payload (weekly/monthly/yearly/eternal boards)
 *   SDD-F02 DropManager        — resource caps for inventory validation on load
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-G01 SceneController    — constructs PersistenceManager at boot, injects into RunScene
 *   SDD-G03 RunScene           — calls persistence.saveLocal(checkpoint) on wave milestones
 *   SDD-G04 ResultScene        — calls persistence.syncToCloud() on run end
 *   SDD-G11 PauseScene         — "Save to Cloud" button calls syncToCloud()
 *   SDD-G08 Debugger           — Persistence tab shows local size, last sync, conflict log
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : <name> / <date>  scope, requires, DoD
 * Programming  : <name> / <date>  contract, Constructor/Adapter, memory, IndexedDB schema
 * Game Design  : <name> / <date>  BALANCE.persistence, feel, migration strategy, pillars
 * TDD          : <name> / <date>  cases named; persistence.test.ts written red
 *
 * DoD (§6.1): spec · tests red · shape · lifecycle · BALANCE · memory ·
 *             IDs · verify green · port fidelity
 * Status: draft
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

// ─── 2. Contract ─────────────────────────────────────────────────────────────
/**
 * Public surface. Ports first, then the classes. Constructor dependencies explicit.
 * No service locators. No globals besides BALANCE.
 * Pure logic — no THREE, no DOM, no GPU work.
 */

// ----- Domain DTOs (serialisable, no methods) -----

export type ResourceId = 'metalScrap' | 'prismaticCrystal' | 'denseCore' | 'darkMatter'

export type WeaponId = 'laser' | 'plasma' | 'beam' | 'mjolnir'

export type BombId = 'pulseNova' | 'swarmTorpedo' | 'starKiller'

export type WingId = 'standard' | 'agility' | 'armored'
export type ShieldFitId = 'light' | 'standard' | 'heavy'
export type ArmorId = 'light' | 'standard' | 'heavy'
export type EnergyCollectorId = 'passive' | 'wide'
export type EnergyConverterId = 'scrap' | 'crystal'

/** Integer 0..BALANCE.ship.stats.byteCap (255). */
export interface BytePoolDTO {
  current: number
  max: number
}

export interface ShipStatsDTO {
  agility: BytePoolDTO
  deflection: BytePoolDTO
  integrity: BytePoolDTO
  shield: BytePoolDTO
  precision: BytePoolDTO
  energy: BytePoolDTO
}

export interface ShipStatusDTO {
  flickering: boolean
  dashing: boolean
  shooting: boolean
  recovering: boolean
}

export interface ShipLoadoutDTO {
  equippedWeapon: WeaponId | null
  weapons: readonly WeaponId[]
  equippedBomb: BombId | null
  bombs: readonly BombId[]
  equippedWings: WingId | null
  wings: readonly WingId[]
  equippedShield: ShieldFitId | null
  shields: readonly ShieldFitId[]
  equippedArmor: ArmorId | null
  armors: readonly ArmorId[]
  equippedEnergyCollector: EnergyCollectorId | null
  energyCollectors: readonly EnergyCollectorId[]
  equippedEnergyConverter: EnergyConverterId | null
  energyConverters: readonly EnergyConverterId[]
}

export interface ShipDTO {
  stats: ShipStatsDTO
  status: ShipStatusDTO
  loadout: ShipLoadoutDTO
  /** ISO 8601 — when this ship snapshot was written. */
  updatedAt: string
}

export interface InventoryDTO {
  metalScrap: number
  prismaticCrystal: number
  denseCore: number
  darkMatter: number
  /** ISO 8601 */
  updatedAt: string
}

export interface RankingsDTO {
  weekly: readonly number[]
  monthly: readonly number[]
  yearly: readonly number[]
  eternal: readonly number[]
  /** ISO 8601 */
  updatedAt: string
}

export interface RunStateDTO {
  score: number
  kills: number
  wave: number
  seed: number
  startedAt: string  // ISO 8601
  endedAt: string | null  // ISO 8601 or null if in-progress
  /** ISO 8601 — when this run state was written. */
  updatedAt: string
}

/** Complete player state — single source of truth for persistence. */
export interface PlayerStateDTO {
  schemaVersion: number
  ship: ShipDTO
  inventory: InventoryDTO
  rankings: RankingsDTO
  runState: RunStateDTO
  /** Anonymous device ID or authenticated user ID. */
  playerId: string
  /** ISO 8601 — last successful cloud sync. */
  lastCloudSyncAt: string | null
}

// ----- Ports (consumers depend on these, not the classes) -----

/** Local persistence operations — synchronous API, async implementation. */
export interface LocalPort {
  /** Writes full state to IndexedDB. Never throws; logs and swallows errors. */
  saveLocal(state: PlayerStateDTO): Promise<void>
  /** Reads full state from IndexedDB. Returns null if empty/missing. */
  loadLocal(): Promise<PlayerStateDTO | null>
  /** Clears the local store (used on "New Game" or corruption recovery). */
  clearLocal(): Promise<void>
  /** Current byte size of the IndexedDB store. */
  getLocalSizeBytes(): Promise<number>
}

/** Cloud persistence operations. */
export interface CloudPort {
  /** Pushes local state to cloud. Returns server state on 409/412 for conflict resolution. */
  pushToCloud(state: PlayerStateDTO): Promise<{ success: boolean; serverState?: PlayerStateDTO; error?: string }>
  /** Pulls latest state from cloud. */
  pullFromCloud(): Promise<PlayerStateDTO | null>
  /** Deletes cloud record (account deletion). */
  deleteCloud(): Promise<void>
}

/** Conflict resolution callback. */
export type ConflictResolver = (local: PlayerStateDTO, remote: PlayerStateDTO) => PlayerStateDTO

/** Unified port the game injects. */
export interface PersistencePort extends LocalPort, CloudPort {
  /** Registers a custom conflict resolver. Default: latest updatedAt wins. */
  setConflictResolver(resolver: ConflictResolver): void
  /** Triggers a full sync: pull → resolve → push. Returns merged state. */
  sync(): Promise<PlayerStateDTO>
  /** Subscribes to sync events (for debugger toast). */
  onSyncEvent(listener: (event: SyncEvent) => void): () => void
}

export type SyncEventType = 'sync-start' | 'sync-success' | 'sync-conflict' | 'sync-error' | 'save-local'

export interface SyncEvent {
  type: SyncEventType
  timestamp: number
  detail?: string
  localUpdatedAt?: string
  remoteUpdatedAt?: string
}

/** Construction options — every value traces to BALANCE.persistence. */
export interface PersistenceOptions {
  /** IndexedDB database name. */
  readonly dbName: string
  /** Object store name. */
  readonly storeName: string
  /** Current schema version. Increment on breaking schema changes. */
  readonly localDBVersion: number
  /** Migration functions keyed by target version. */
  readonly migrations: Readonly<Record<number, (data: unknown) => PlayerStateDTO>>
  /** Cloud API base URL (e.g., "https://api.mongodb-atlas.com/endpoint"). */
  readonly apiEndpoint: string
  /** API key or bearer token. Empty string = anonymous mode (device-id only). */
  readonly apiKey: string
  /** Sync triggers. */
  readonly syncTriggers: Readonly<{
    readonly endOfRun: boolean
    readonly manual: boolean
    readonly checkpointWaves: readonly number[]
  }>
  /** Retry backoff in ms for failed cloud requests. */
  readonly retryBackoffMs: readonly number[]
  /** Max local storage quota in bytes. */
  readonly maxLocalSizeBytes: number
  /** Injected clock for tests. Defaults to Date.now. */
  readonly now?: () => number
  /** Injected UUID generator for device-id. Defaults to crypto.randomUUID. */
  readonly generateId?: () => string
}

/** Default conflict resolver: latest updatedAt wins; tie → local. */
export function defaultConflictResolver(local: PlayerStateDTO, remote: PlayerStateDTO): PlayerStateDTO {
  const localTime = new Date(local.ship.updatedAt).getTime()
  const remoteTime = new Date(remote.ship.updatedAt).getTime()
  if (remoteTime > localTime) return remote
  return local
}

// ----- Adapters (translate between domain, local, cloud) -----

/** Serialises domain objects → PlayerStateDTO. Pure functions, no I/O. */
export interface GameStateSerializer {
  /** Builds DTO from live game objects (Ship, RunState, etc.). */
  serialise(ship: ShipDebugPort, inventory: Inventory, runState: RunState, rankings: Rankings): PlayerStateDTO
  /** Rehydrates live objects from DTO. Returns factories for each domain. */
  deserialise(dto: PlayerStateDTO): {
    shipOptions: ShipOptions
    inventoryData: InventoryDTO
    runStateData: RunStateDTO
    rankingsData: RankingsDTO
  }
}

/** Translates PlayerStateDTO ↔ IndexedDB record. */
export interface LocalAdapter {
  toRecord(dto: PlayerStateDTO): IDBValidKey
  fromRecord(record: IDBValidKey): PlayerStateDTO
}

/** Translates PlayerStateDTO ↔ MongoDB Atlas document (REST JSON). */
export interface CloudAdapter {
  toDocument(dto: PlayerStateDTO): Record<string, unknown>
  fromDocument(doc: Record<string, unknown>): PlayerStateDTO
  /** Builds request headers (auth, content-type). */
  headers(): Record<string, string>
}

/** IndexedDB wrapper — minimal surface for testability. */
export interface IDBWrapper {
  open(dbName: string, version: number, upgrade: (db: IDBDatabase) => void): Promise<IDBDatabase>
  put(db: IDBDatabase, storeName: string, key: IDBValidKey, value: unknown): Promise<void>
  get(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<unknown>
  delete(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<void>
  clear(db: IDBDatabase, storeName: string): Promise<void>
  getAllKeys(db: IDBDatabase, storeName: string): Promise<IDBValidKey[]>
  close(db: IDBDatabase): void
}

/** Fetch wrapper for cloud calls — minimal surface for testability. */
export interface FetchWrapper {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>
}

// ----- Implementation classes -----

export declare class PersistenceManager implements PersistencePort {
  constructor(
    options: PersistenceOptions,
    serializer: GameStateSerializer,
    localAdapter: LocalAdapter,
    cloudAdapter: CloudAdapter,
    idb: IDBWrapper,
    fetch: FetchWrapper
  )

  // LocalPort
  saveLocal(state: PlayerStateDTO): Promise<void>
  loadLocal(): Promise<PlayerStateDTO | null>
  clearLocal(): Promise<void>
  getLocalSizeBytes(): Promise<number>

  // CloudPort
  pushToCloud(state: PlayerStateDTO): Promise<{ success: boolean; serverState?: PlayerStateDTO; error?: string }>
  pullFromCloud(): Promise<PlayerStateDTO | null>
  deleteCloud(): Promise<void>

  // PersistencePort
  setConflictResolver(resolver: ConflictResolver): void
  sync(): Promise<PlayerStateDTO>
  onSyncEvent(listener: (event: SyncEvent) => void): () => void

  /** Runs pending migrations if schemaVersion < localDBVersion. */
  migrateIfNeeded(): Promise<void>

  /** Disposes IndexedDB connection, removes listeners. */
  dispose(): void
}

export declare class SyncController {
  constructor(
    persistence: PersistencePort,
    options: Pick<PersistenceOptions, 'syncTriggers' | 'retryBackoffMs'>
  )

  /** Called by RunScene on wave milestones. */
  maybeCheckpoint(wave: number, state: PlayerStateDTO): Promise<void>
  /** Called by ResultScene on run end. */
  onRunEnd(state: PlayerStateDTO): Promise<void>
  /** Called by PauseScene on manual save. */
  manualSync(state: PlayerStateDTO): Promise<void>

  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field / method              | type                    | meaning / unit / range
 *   ----------------------------|-------------------------|------------------------------------------
 *   _options                    | PersistenceOptions      | constructor-injected config
 *   _serializer                 | GameStateSerializer     | domain ↔ DTO
 *   _localAdapter               | LocalAdapter            | DTO ↔ IndexedDB
 *   _cloudAdapter               | CloudAdapter            | DTO ↔ MongoDB document
 *   _idb                        | IDBWrapper              | IndexedDB operations
 *   _fetch                      | FetchWrapper            | HTTP calls
 *   _db                         | IDBDatabase | null      | open IndexedDB connection
 *   _conflictResolver           | ConflictResolver        | latest-updatedAt-wins (replaceable)
 *   _syncListeners              | Set<(e)=>void>          | debugger toast subscribers
 *   _playerId                   | string                  | device-id or auth user-id
 *
 * PersistenceManager.saveLocal:
 *   1. state.schemaVersion = options.localDBVersion
 *   2. state.playerId = _playerId (generated on first run)
 *   3. state.ship.updatedAt = state.inventory.updatedAt = state.runState.updatedAt =
 *      state.rankings.updatedAt = now().toISOString()
 *   4. record = _localAdapter.toRecord(state)
 *   5. await _idb.put(_db, _options.storeName, 'player-state', record)
 *   6. emit SyncEvent { type: 'save-local', timestamp: now() }
 *   7. if size > maxLocalSizeBytes: log warning (no eviction — user data sacred)
 *
 * PersistenceManager.loadLocal:
 *   1. record = await _idb.get(_db, _options.storeName, 'player-state')
 *   2. if null: return null
 *   3. dto = _localAdapter.fromRecord(record)
 *   4. if dto.schemaVersion < _options.localDBVersion: await migrateIfNeeded()
 *   5. return dto
 *
 * PersistenceManager.pushToCloud:
 *   1. doc = _cloudAdapter.toDocument(state)
 *   2. res = await _fetch(`${apiEndpoint}/players/${_playerId}`, {
 *        method: 'PUT', headers: _cloudAdapter.headers(), body: JSON.stringify(doc) })
 *   3. if 2xx: return { success: true }
 *   4. if 409/412: serverDoc = await res.json(); return { success: false, serverState: _cloudAdapter.fromDocument(serverDoc) }
 *   5. else: retry with backoff (options.retryBackoffMs); finally return { success: false, error }
 *
 * PersistenceManager.sync:
 *   1. emit 'sync-start'
 *   2. local = await loadLocal(); if !local: return pushToCloud(empty) → success
 *   3. remote = await pullFromCloud(); if !remote: return pushToCloud(local)
 *   4. if local.ship.updatedAt === remote.ship.updatedAt: return local (tie → local)
 *   5. merged = _conflictResolver(local, remote)
 *   6. await saveLocal(merged)
 *   7. pushResult = await pushToCloud(merged)
 *   8. if pushResult.success: emit 'sync-success', lastCloudSyncAt = now()
 *   9. else if pushResult.serverState: emit 'sync-conflict', recurse once with serverState
 *   10. else: emit 'sync-error'
 *   11. return merged
 *
 * PersistenceManager.migrateIfNeeded:
 *   while dto.schemaVersion < options.localDBVersion:
 *     dto = options.migrations[dto.schemaVersion + 1](dto)
 *     dto.schemaVersion++
 *   await saveLocal(dto)
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. saveLocal/loadLocal never throw — errors are logged, promise resolves.
 *   R2. All IndexedDB operations are off the frame path (microtask or idle callback).
 *   R3. PlayerStateDTO is fully serialisable JSON — no functions, symbols, circular refs.
 *   R4. schemaVersion is monotonically increasing. Migrations are pure functions.
 *   R5. _playerId is generated once (crypto.randomUUID) and persisted in DTO.
 *       Anonymous mode: device-id only. Auth mode: replaces _playerId on login.
 *   R6. Conflict resolution is deterministic: latest updatedAt wins; tie → local.
 *       Resolver is pure — no I/O, no randomness.
 *   R7. sync() is idempotent: calling twice with same inputs yields same result.
 *   R8. CloudAdapter never leaks API keys in logs or error messages.
 *   R9. Memory: PersistenceManager created-once at boot. dispose() closes IDB,
 *       clears listeners, nulls _db. No per-frame allocations.
 *   R10. Per-frame allocation: zero. All async work uses existing closures.
 *   R11. Retry backoff respects Retry-After header if present; else options.retryBackoffMs.
 *   R12. LocalAdapter/CloudAdapter/GameStateSerializer are stateless — safe to share.
 *   R13. Inventory caps (RES-05) are validated on deserialise; overflow is clamped to cap.
 *   R14. RunStateDTO.endedAt is null for in-progress runs; ISO string on completion.
 *   R15. RankingsDTO arrays are top-100 scores per board; sorted descending.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — pure logic, no visual representation.
 * Inheritance: N/A (pure logic)
 * syncRender writes: N/A
 * Never writes: gameplay state
 * Scene ownership: N/A — owned by SceneController (G01), injected into RunScene (G03)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * New A01 section (declare here, add to SDD-A01):
 *
 *   BALANCE.persistence.localDBVersion      = 1
 *   BALANCE.persistence.dbName              = 'ikarus-poc2'
 *   BALANCE.persistence.storeName           = 'player-state'
 *   BALANCE.persistence.apiEndpoint         = 'https://<cluster>.mongodb.net/api/atlas/v1.0'
 *   BALANCE.persistence.apiKey              = ''            // empty = anonymous device-id
 *   BALANCE.persistence.maxLocalSizeBytes   = 52428800      // 50 MiB
 *   BALANCE.persistence.syncTriggers.endOfRun = true
 *   BALANCE.persistence.syncTriggers.manual     = true
 *   BALANCE.persistence.syncTriggers.checkpointWaves = [10, 25, 50, 100, 200, 500]
 *   BALANCE.persistence.retryBackoffMs      = [1000, 3000, 10000]
 *   BALANCE.persistence.conflictStrategy    = 'latest-timestamp-wins'
 *
 * Feel:      Local save is imperceptible (<50 ms on mid-tier mobile). Cloud sync runs
 *            after the ResultScene fades in — player sees "Syncing…" toast, then
 *            "Synced" or "Conflict resolved" within 2–3 s on 3G. No modal blockers.
 *            Offline play is fully functional; sync catches up on next online launch.
 * Leveling:  Schema migrations allow adding fields (e.g., new equipment slots,
 *            cosmetic unlocks) without wiping player data. Migration scripts are
 *            pure, tested, and versioned in BALANCE.
 * Graphics:  N/A — persistence has no visuals. Debugger tab (G08) shows:
 *            local size, last sync timestamp, conflict count, playerId (masked).
 * Pillars:   4 (legibility — sync status readable at a glance), 6 (leaderboards
 *            require reliable cloud sync), 3 (progression without dead time —
 *            auto-save at checkpoints, no "save menu").
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * Protocol: write persistence.test.ts FIRST. `npm run test` must FAIL for the
 * named cases (red). Programming then implements until green.
 *
 * File: poc2/src/systems/persistence.test.ts
 * Runner: vitest (`npm run test` in poc2/)
 * Mocks: IDBWrapper (fake-indexeddb or in-memory map), FetchWrapper (msw or manual),
 *        GameStateSerializer (stub), LocalAdapter/CloudAdapter (stubs),
 *        BALANCE.persistence stub, now() / generateId() fakes.
 *
 * describe('PersistenceManager')
 *   it('saveLocal writes PlayerStateDTO to IndexedDB with updatedAt timestamps')  // R1, R3
 *   it('loadLocal returns null on empty store')                                    // R1
 *   it('loadLocal restores state with deep equality to saved DTO')                 // R3, R13
 *   it('saveLocal clamps inventory counts to BALANCE caps on deserialise')         // R13, RES-05
 *   it('migrateIfNeeded runs migration scripts in order and updates schemaVersion') // R4
 *   it('pushToCloud returns {success:true} on 2xx')                                // R8
 *   it('pushToCloud returns serverState on 409 for conflict resolution')           // R6
 *   it('pushToCloud retries with backoff on 5xx and network error')                // R11
 *   it('pullFromCloud returns parsed PlayerStateDTO on 200')                       // R8
 *   it('sync merges local+remote using defaultConflictResolver (latest updatedAt)') // R6, R7
 *   it('sync tie-breaker: equal updatedAt → local wins')                           // R6
 *   it('sync emits sync-start → sync-success events in order')                     // debugger
 *   it('sync emits sync-conflict when 409 and resolver produces merged state')     // R6
 *   it('sync emits sync-error on persistent network failure')                      // R11
 *   it('setConflictResolver replaces the resolver for subsequent syncs')           // R6
 *   it('onSyncEvent returns unsubscribe function')                                 // G08
 *   it('clearLocal removes the record and returns empty on loadLocal')             // R1
 *   it('getLocalSizeBytes returns byte count')                                     // G08
 *   it('dispose closes IDB and clears listeners; no memory leak')                  // R9
 *   it('saveLocal/loadLocal allocate zero objects on the frame path')              // R2, R10
 *   it('PlayerStateDTO serialises to valid JSON (no circular, no functions)')      // R3
 *   it('anonymous mode: playerId is generated once and persisted')                 // R5
 *   it('auth mode: playerId replaced on login; cloud uses new ID')                 // R5
 *
 * describe('SyncController')
 *   it('maybeCheckpoint calls sync when wave matches checkpointWaves')             // RUL-06
 *   it('maybeCheckpoint does nothing when wave not in checkpointWaves')            // RUL-06
 *   it('onRunEnd calls sync with endOfRun trigger')                                // RUL-06
 *   it('manualSync calls sync with manual trigger')                                // G11
 *   it('dispose cleans up internal references')                                    // R9
 *
 * describe('GameStateSerializer')
 *   it('serialise builds PlayerStateDTO from ShipDebugPort, Inventory, RunState, Rankings') // R3
 *   it('deserialise returns ShipOptions, InventoryDTO, RunStateDTO, RankingsDTO') // R3, R13
 *   it('deserialise clamps inventory to caps')                                     // R13, RES-05
 *   it('serialise/deserialise round-trip preserves all fields')                    // R3
 *
 * describe('Adapters')
 *   it('LocalAdapter.toRecord/fromRecord round-trip preserves DTO')                // R3
 *   it('CloudAdapter.toDocument/fromDocument round-trip preserves DTO')            // R3, R8
 *   it('CloudAdapter.headers includes Authorization when apiKey set')              // R8
 *   it('CloudAdapter.headers omits Authorization when apiKey empty')               // R8
 *
 * Manual:
 *   A-manual-1. [manual] Play a full run offline, close tab, reopen: state intact
 *   A-manual-2. [manual] Play online, kill network at result screen: toast shows
 *               "Sync queued", reconnect → "Synced"
 *   A-manual-3. [manual] Simulate conflict (edit localStorage updatedAt to past),
 *               launch online: conflict resolved silently, debugger shows count++
 *   A-manual-4. [manual] DevTools Application → IndexedDB: single key 'player-state',
 *               value is valid JSON, size < 50 MB after 100 runs
 *   A-manual-5. [manual] MongoDB Atlas collection shows one doc per playerId,
 *               fields match PlayerStateDTO, updatedAt indexed
 *
 * Coverage: R1–R15 + card Acceptance (offline-first, cloud sync on triggers,
 *           conflict resolution, migrations, debugger visibility) + RUL-06 + SHIP-06 + RES-05.
 */

// Re-exports for consumers (tests, SceneController)
export type {
  PlayerStateDTO,
  ShipDTO,
  ShipStatsDTO,
  ShipStatusDTO,
  ShipLoadoutDTO,
  InventoryDTO,
  RankingsDTO,
  RunStateDTO,
  BytePoolDTO,
  PersistenceOptions,
  PersistencePort,
  LocalPort,
  CloudPort,
  ConflictResolver,
  SyncEvent,
  SyncEventType,
  GameStateSerializer,
  LocalAdapter,
  CloudAdapter,
  IDBWrapper,
  FetchWrapper,
  ShipDebugPort,
  Inventory,
  RunState,
  Rankings,
  ShipOptions
}