/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { G3d, MeshSection } from './g3d'
import { Geometry, Transparency } from './geometry'
import { IMaterialLibrary, VimMaterials } from './materials'

/**
 * Builds meshes from the g3d and BufferGeometry
 * Allows to reuse the same material for all new built meshes
 */
export class MeshBuilder {
  readonly materials: IMaterialLibrary

  constructor (materials?: IMaterialLibrary) {
    this.materials = materials ?? new VimMaterials()
  }

  /**
   * Creates Instanced Meshes from the g3d data
   * @param transparency Specify wheter color is RBG or RGBA and whether material is opaque or transparent
   * @param instances instance indices from the g3d for which meshes will be created.
   *  If undefined, all multireferenced meshes will be created.
   * @returns an array of THREE.InstancedMesh
   */
  createInstancedMeshes (
    g3d: G3d,
    transparency: Transparency.Mode,
    instances?: number[]
  ): THREE.InstancedMesh[] {
    const result: (THREE.InstancedMesh | undefined)[] = []
    const set = instances ? new Set(instances) : undefined

    for (let mesh = 0; mesh < g3d.getMeshCount(); mesh++) {
      let meshInstances = g3d.meshInstances[mesh]
      if (!meshInstances) continue

      meshInstances = set
        ? meshInstances.filter((i) => set.has(i))
        : meshInstances.filter((i) => (g3d.instanceFlags[i] & 1) === 0)

      if (meshInstances.length <= 1) continue

      const createMesh = (section: MeshSection, transparent: boolean) => {
        const count = g3d.getMeshSubmeshCount(mesh, section)
        if (count <= 0) return
        const geometry = Geometry.createGeometryFromMesh(
          g3d,
          mesh,
          section,
          transparent
        )
        return this.createInstancedMesh(
          geometry,
          g3d,
          meshInstances,
          transparent
        )
      }

      switch (transparency) {
        case 'all': {
          result.push(createMesh('opaque', false))
          result.push(createMesh('transparent', true))
          break
        }
        case 'allAsOpaque': {
          result.push(createMesh('all', false))
          break
        }
        case 'opaqueOnly': {
          result.push(createMesh('opaque', false))
          break
        }
        case 'transparentOnly': {
          result.push(createMesh('transparent', true))
          break
        }
      }
    }
    const filter = result.filter((m): m is THREE.InstancedMesh => !!m)
    return filter
  }

  /**
   * Creates a InstancedMesh from g3d data and given instance indices
   * @param geometry Geometry to use in the mesh
   * @param instances Instance indices for which matrices will be applied to the mesh
   * @param useAlpha Specify whether to use RGB or RGBA
   * @returns a THREE.InstancedMesh
   */
  createInstancedMesh (
    geometry: THREE.BufferGeometry,
    g3d: G3d,
    instances: number[],
    useAlpha: boolean
  ) {
    const material = useAlpha
      ? this.materials.transparent
      : this.materials.opaque

    const result = new THREE.InstancedMesh(geometry, material, instances.length)
    geometry.computeBoundingBox()

    const boxes: THREE.Box3[] = []
    for (let i = 0; i < instances.length; i++) {
      const matrix = Geometry.getInstanceMatrix(g3d, instances[i])
      result.setMatrixAt(i, matrix)
      boxes[i] = geometry.boundingBox!.clone().applyMatrix4(matrix)
    }
    result.userData.instances = instances
    result.userData.boxes = boxes
    return result
  }

  /**
   * Create a merged mesh from g3d instance indices
   * @param transparency Specify wheter color is RBG or RGBA and whether material is opaque or transparent
   * @param instances g3d instance indices to be included in the merged mesh. All mergeable meshes if undefined.
   * @returns a THREE.Mesh or undefined if the mesh would be empty
   */
  createMergedMesh (
    g3d: G3d,
    section: MeshSection,
    transparent: boolean,
    instances?: number[]
  ): THREE.Mesh | undefined {
    const merge = instances
      ? Geometry.mergeInstanceMeshes(g3d, section, transparent, instances)
      : Geometry.mergeUniqueMeshes(g3d, section, transparent)
    if (!merge) return

    const material = transparent
      ? this.materials.transparent
      : this.materials.opaque

    const mesh = new THREE.Mesh(merge.geometry, material)
    mesh.userData.merged = true
    mesh.userData.instances = merge.instances
    mesh.userData.submeshes = merge.submeshes
    mesh.userData.boxes = merge.boxes

    return mesh
  }

  /**
   * Create a wireframe mesh from g3d instance indices
   * @param instances g3d instance indices to be included in the merged mesh. All mergeable meshes if undefined.
   * @returns a THREE.Mesh
   */
  createWireframe (g3d: G3d, instances: number[]) {
    const geometry = Geometry.createGeometryFromInstances(g3d, instances)
    if (!geometry) return
    const wireframe = new THREE.WireframeGeometry(geometry)
    return new THREE.LineSegments(wireframe, this.materials.wireframe)
  }
}
