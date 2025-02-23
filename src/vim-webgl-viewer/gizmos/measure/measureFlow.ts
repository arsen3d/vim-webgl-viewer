/**
 @module viw-webgl-viewer
*/

import { InputScheme } from '../../input'
import { InputAction } from '../../raycaster'
import { Measure } from './measure'

export type MeasureStage = 'ready' | 'active' | 'done' | 'failed'

/**
 * Inputs scheme for measuring as a small state machine.
 */
export class MeasureFlow implements InputScheme {
  private readonly _gizmoMeasure: Measure
  private _stage: MeasureStage | undefined
  private removeMouseListener: (() => void) | undefined

  constructor (gizmoMeasure: Measure) {
    this._gizmoMeasure = gizmoMeasure
    this._stage = 'ready'
  }

  onProgress: ((stage: MeasureStage) => void) | undefined
  onComplete: ((success: boolean) => void) | undefined

  get stage () {
    return this._stage
  }

  private unregister () {
    this.removeMouseListener?.()
    this.removeMouseListener = undefined
  }

  abort () {
    if (this.stage === 'active' || this.stage === 'ready') {
      this._stage = undefined
      this.onComplete?.(false)
      this.unregister()
    }
  }

  onMainAction (action: InputAction) {
    switch (this._stage) {
      case 'ready':
        if (!action.object) return
        this._gizmoMeasure.onFirstClick(action)
        this._stage = 'active'
        this.onProgress?.(this._stage)
        break
      case 'active':
        this._stage = this._gizmoMeasure.onSecondClick(action)
          ? 'done'
          : 'failed'
        this.onProgress?.(this._stage)
        this.onComplete?.(this._stage === 'done')
        this.unregister()
        break
    }
  }

  onIdleAction (action: InputAction) {
    if (this._stage === 'active') this._gizmoMeasure.onMouseIdle(action)
  }

  onKeyAction (key: number) {
    return false
  }
}
