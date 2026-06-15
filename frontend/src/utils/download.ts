import api from '../api/client'

/**
 * Download the original uploaded file for a dataset.
 *
 * Uses the API client (with cookie + Bearer auth) to fetch the file as a blob,
 * then triggers a synthetic download via an object URL. Works for both JWT
 * cookie sessions and PAT users.
 */
export async function downloadDatasetFile(
  datasetId: string,
  suggestedFilename?: string,
): Promise<void> {
  const response = await api.get(`/datasets/${datasetId}/download`, {
    responseType: 'blob',
  })

  // Try to honor the server-provided filename; fall back to the caller's hint
  // and finally to the dataset id.
  let filename = suggestedFilename || `dataset-${datasetId}`
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
