import api from '../api/client'

/**
 * Fetch an API path as a blob (with cookie + Bearer auth) and trigger a
 * synthetic browser download, honoring a server-provided Content-Disposition
 * filename when present.
 */
async function fetchAndSave(path: string, fallbackName: string): Promise<void> {
  const response = await api.get(path, { responseType: 'blob' })

  let filename = fallbackName
  const disposition = response.headers['content-disposition']
  if (disposition) {
    const match = /filename="?([^"]+)"?/i.exec(disposition)
    if (match) filename = match[1]
  }

  const blob = response.data as Blob
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    // Defer revocation slightly so the browser has time to start the save.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/** Download the original uploaded file for a dataset. */
export function downloadDatasetFile(
  datasetId: string,
  suggestedFilename?: string,
): Promise<void> {
  return fetchAndSave(`/datasets/${datasetId}/download`, suggestedFilename || `dataset-${datasetId}`)
}

/**
 * Export a dataset's converted data as standard AnnData .h5ad (materialized
 * from the TileDB-SOMA store on the server). Useful to get a portable h5ad out
 * of a loom upload, or to round-trip the data.
 */
export function downloadDatasetExport(
  datasetId: string,
  suggestedFilename?: string,
): Promise<void> {
  return fetchAndSave(`/datasets/${datasetId}/export`, suggestedFilename || `dataset-${datasetId}.h5ad`)
}
