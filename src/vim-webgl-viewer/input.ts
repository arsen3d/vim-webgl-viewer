/**
 * @module viw-webgl-viewer
 */

import * as THREE from 'three'
import { Viewer } from './viewer'
import { KeyboardHandler, KEYS } from './keyboard'
import { TouchHandler } from './touch'
import { MouseHandler } from './mouse'
import { InputAction } from './raycaster'
import { SignalDispatcher } from 'ste-signals'
import { SimpleEventDispatcher } from 'ste-simple-events'
export { KEYS } from './keyboard'

export type PointerMode = 'orbit' | 'look' | 'pan' | 'zoom' | 'rect'

/**
 * Defines an input scheme for the viewer.
 */
export interface InputScheme {
  /**
   * Called when mouse clicked or mobile tap.
   */
  onMainAction(hit: InputAction): void

  /**
   * Called once when mouse and camera have been idle for some time with the position where it stopped.
   * Called once when the mouse moves again with undefined
   */
  onIdleAction(hit: InputAction | undefined): void

  /**
   * Called when a key is pressed and released.
   */
  onKeyAction(key: number): boolean
}

/**
 * Vim viewer default input scheme
 */
export class DefaultInputScheme implements InputScheme {
  private _viewer: Viewer
  constructor (viewer: Viewer) {
    this._viewer = viewer
  }

  onMainAction (action: InputAction): void {
    const camera = this._viewer.camera
    const selection = this._viewer.selection

    if (!action?.object) {
      selection.select(undefined)
      if (action.type === 'double') {
        camera.frame('all', 'none', camera.defaultLerpDuration)
      }
      return
    }

    if (action.modifier !== 'none') {
      selection.toggle(action.object)
    } else {
      selection.select(action.object)
    }

    if (action.type === 'double') {
      camera.frame(action.object, 'none', camera.defaultLerpDuration)
    }

    action.object.getBimElement().then((e) => {
      e?.set('Index', action.object?.element)
      console.log(e)
    })
  }

  onIdleAction (hit: InputAction): void {
    this._viewer.selection.focus(hit?.object)
  }

  onKeyAction (key: number): boolean {
    const camera = this._viewer.camera
    const selection = this._viewer.selection
    switch (key) {
      case KEYS.KEY_P:
        camera.orthographic = !camera.orthographic
        return true
      case KEYS.KEY_ADD:
      case KEYS.KEY_OEM_PLUS:
        camera.speed += 1
        return true
      case KEYS.KEY_SUBTRACT:
      case KEYS.KEY_OEM_MINUS:
        camera.speed -= 1
        return true
      case KEYS.KEY_F8:
      case KEYS.KEY_SPACE:
        this._viewer.inputs.pointerActive = this._viewer.inputs.pointerFallback
        return true
      case KEYS.KEY_HOME:
        camera.frame('all', 45, camera.defaultLerpDuration)
        return true
      // Selection
      case KEYS.KEY_ESCAPE:
        selection.clear()
        return true
      case KEYS.KEY_Z:
      case KEYS.KEY_F:
        if (selection.count > 0) {
          camera.frame(
            selection.getBoundingBox(),
            'center',
            camera.defaultLerpDuration
          )
        } else {
          camera.frame('all', 'center', camera.defaultLerpDuration)
        }
        return true
      default:
        return false
    }
  }
}

/**
 * Manages and registers all viewer user inputs for mouse, keyboard and touch
 */
export class Input {
  // Dependencies
  private _viewer: Viewer

  /**
   * Touch input handler
   */
  touch: TouchHandler
  /**
   * Mouse input handler
   */
  mouse: MouseHandler
  /**
   * Keyboard input handler
   */
  keyboard: KeyboardHandler

  private _pointerActive: PointerMode = 'orbit'
  private _pointerFallback: PointerMode = 'look'
  private _pointerOverride: PointerMode | undefined

  /**
   * Returns the last main mode (orbit, look) that was active.
   */
  get pointerFallback () {
    return this._pointerFallback
  }

  /**
   * Returns current pointer mode.
   */
  get pointerActive () {
    return this._pointerActive
  }

  /**
   * A temporary pointer mode used for temporary icons.
   */
  get pointerOverride () {
    return this._pointerOverride
  }

  set pointerOverride (value: PointerMode | undefined) {
    if (value === this._pointerOverride) return
    this._pointerOverride = value
    this._onPointerOverrideChanged.dispatch()
  }

  /**
   * Changes pointer interaction mode. Look mode will set camera orbitMode to false.
   */
  set pointerActive (value: PointerMode) {
    if (value === this._pointerActive) return

    if (value === 'look') this._pointerFallback = 'orbit'
    else if (value === 'orbit') this._pointerFallback = 'look'
    this._viewer.gizmoRectangle.visible = false

    this._viewer.camera.orbitMode = value !== 'look'
    this._pointerActive = value
    this._onPointerModeChanged.dispatch()
  }

  /**
   * Event called when pointer interaction mode changes.
   */
  private _onPointerModeChanged = new SignalDispatcher()
  get onPointerModeChanged () {
    return this._onPointerModeChanged.asEvent()
  }

  /**
   * Event called when the pointer is temporarily overriden.
   */
  private _onPointerOverrideChanged = new SignalDispatcher()
  get onPointerOverrideChanged () {
    return this._onPointerOverrideChanged.asEvent()
  }

  /**
   * Event called when when context menu could be displayed
   */
  private _onContextMenu = new SimpleEventDispatcher<THREE.Vector2>()
  get onContextMenu () {
    return this._onContextMenu.asEvent()
  }

  private _scheme: InputScheme

  /**
   * Get or set the current viewer input scheme, set undefined to revert to default.
   */
  get scheme () {
    return this._scheme
  }

  set scheme (value: InputScheme | undefined) {
    this._scheme = value ?? new DefaultInputScheme(this._viewer)
  }

  /**
   * Calls main action on the current input scheme
   */
  MainAction (action: InputAction) {
    this._scheme.onMainAction(action)
  }

  /**
   * Calls idle action on the current input scheme
   */
  IdleAction (action: InputAction | undefined) {
    this._scheme.onIdleAction(action)
  }

  /**
   * Calls key action on the current input scheme
   */
  KeyAction (key: number) {
    return this._scheme.onKeyAction(key)
  }

  /**
   * Calls context menu action
   */
  ContextMenu (position: THREE.Vector2) {
    this._onContextMenu.dispatch(position)
  }

  constructor (viewer: Viewer) {
    this._viewer = viewer

    this.keyboard = new KeyboardHandler(viewer)
    this.mouse = new MouseHandler(viewer)
    this.touch = new TouchHandler(viewer)
    this._scheme = new DefaultInputScheme(viewer)
    this.pointerActive = 'orbit'
    this._pointerFallback = 'look'
  }

  /**
   * Register inputs handlers for default viewer behavior
   */
  registerAll () {
    this.keyboard.register()
    this.mouse.register()
    this.touch.register()
  }

  /**
   * Unregisters all input handlers
   */
  unregisterAll = () => {
    this.mouse.unregister()
    this.keyboard.unregister()
    this.touch.unregister()
  }

  /**
   * Resets all input state
   */
  resetAll () {
    this.mouse.reset()
    this.keyboard.reset()
    this.touch.reset()
  }
}
