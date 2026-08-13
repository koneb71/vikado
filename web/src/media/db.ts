import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project } from '@/schema/project'

/** Small metadata summary shown on the project list screen. */
export interface ProjectSummary {
  id: string
  name: string
  updatedAt: string
  createdAt: string
  duration: number
}

interface VikadoDB extends DBSchema {
  projects: {
    key: string
    value: Project
    indexes: { 'by-updated': string }
  }
  thumbnails: {
    // filmstrip per asset: JPEG blob of horizontally tiled frames
    key: string // asset hash
    value: { hash: string; frameWidth: number; frameHeight: number; intervalS: number; blob: Blob }
  }
  waveforms: {
    key: string // asset hash
    value: { hash: string; bucketsPerSecond: number; peaks: Float32Array }
  }
}

let dbPromise: Promise<IDBPDatabase<VikadoDB>> | null = null

function db(): Promise<IDBPDatabase<VikadoDB>> {
  dbPromise ??= openDB<VikadoDB>('vikado', 1, {
    upgrade(d) {
      const projects = d.createObjectStore('projects', { keyPath: 'id' })
      projects.createIndex('by-updated', 'updatedAt')
      d.createObjectStore('thumbnails', { keyPath: 'hash' })
      d.createObjectStore('waveforms', { keyPath: 'hash' })
    },
  })
  return dbPromise
}

export async function saveProject(project: Project): Promise<void> {
  await (await db()).put('projects', project)
}

export async function getProject(id: string): Promise<Project | undefined> {
  return (await db()).get('projects', id)
}

export async function deleteProject(id: string): Promise<void> {
  await (await db()).delete('projects', id)
}

export async function listProjects(): Promise<Project[]> {
  const all = await (await db()).getAll('projects')
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function putThumbnails(entry: {
  hash: string
  frameWidth: number
  frameHeight: number
  intervalS: number
  blob: Blob
}): Promise<void> {
  await (await db()).put('thumbnails', entry)
}

export async function getThumbnails(hash: string) {
  return (await db()).get('thumbnails', hash)
}

export async function putWaveform(entry: {
  hash: string
  bucketsPerSecond: number
  peaks: Float32Array
}): Promise<void> {
  await (await db()).put('waveforms', entry)
}

export async function getWaveform(hash: string) {
  return (await db()).get('waveforms', hash)
}
