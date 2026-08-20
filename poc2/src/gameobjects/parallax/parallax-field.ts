/**
 * SDD-B02 ParallaxField — owns the three DYNAMIC VIEW layers.
 */

import type { PerspectiveCamera } from 'three'
import { ParallaxLayer, type ParallaxLayerConfig } from './parallax-layer'

export class ParallaxField {
  readonly layers: readonly ParallaxLayer[]

  constructor(layerConfigs: readonly ParallaxLayerConfig[]) {
    this.layers = layerConfigs.map((config) => new ParallaxLayer(config))
  }

  update(dt: number, camera: PerspectiveCamera): void {
    for (const layer of this.layers) {
      layer.update(dt, camera)
    }
  }

  syncRender(): void {
    for (const layer of this.layers) {
      layer.syncRender()
    }
  }

  layerCount(): number {
    return this.layers.length
  }

  layerNames(): readonly string[] {
    return this.layers.map((layer) => layer.name)
  }

  config(index: number): ParallaxLayerConfig | null {
    const layer = this.layers[index]
    return layer ? layer.config() : null
  }

  applyConfig(index: number, config: ParallaxLayerConfig): void {
    const layer = this.layers[index]
    if (!layer) {
      return
    }
    layer.applyConfig(config)
  }

  setVisible(index: number, visible: boolean): void {
    this.layers[index]?.setVisible(visible)
  }

  visible(index: number): boolean {
    return this.layers[index]?.visible() ?? false
  }

  dispose(): void {
    for (const layer of this.layers) {
      layer.dispose()
    }
  }
}
