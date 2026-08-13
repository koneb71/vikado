/**
 * Origin Private File System storage for imported media.
 * Files are content-addressed: media/<sha256-hex>. Duplicate imports dedupe
 * for free and the hash doubles as the upload key at export time.
 */

async function mediaDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle('media', { create: true })
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function storeFile(file: File): Promise<{ hash: string; existed: boolean }> {
  const bytes = await file.arrayBuffer()
  const hash = await sha256Hex(bytes)
  const dir = await mediaDir()
  try {
    await dir.getFileHandle(hash)
    return { hash, existed: true }
  } catch {
    // not stored yet
  }
  const handle = await dir.getFileHandle(hash, { create: true })
  const writable = await handle.createWritable()
  await writable.write(bytes)
  await writable.close()
  return { hash, existed: false }
}

export async function getFile(hash: string): Promise<File> {
  const dir = await mediaDir()
  const handle = await dir.getFileHandle(hash)
  return handle.getFile()
}

export async function deleteFile(hash: string): Promise<void> {
  const dir = await mediaDir()
  await dir.removeEntry(hash).catch(() => {})
}

export async function listFiles(): Promise<string[]> {
  const dir = await mediaDir()
  const names: string[] = []
  for await (const name of dir.keys()) names.push(name)
  return names
}

const objectUrls = new Map<string, string>()

/** Object URL for an OPFS file, cached per hash for the session. */
export async function getObjectUrl(hash: string): Promise<string> {
  const cached = objectUrls.get(hash)
  if (cached) return cached
  const file = await getFile(hash)
  const url = URL.createObjectURL(file)
  objectUrls.set(hash, url)
  return url
}

export async function requestPersistence(): Promise<void> {
  if (navigator.storage.persist) await navigator.storage.persist().catch(() => {})
}
