/** Long edge sent to the AI: plenty for handwriting, and a small upload. */
export const MAX_IMAGE_EDGE = 2000

/**
 * Shrinks a phone photo before upload (often 4000+ px and several MB) and
 * turns it into a JPEG. The browser also applies the EXIF rotation, so the
 * test is upright. Throws if the browser can't open the file (e.g. HEIC).
 */
export async function prepareImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(
      1,
      MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height),
    )
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available')
    context.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    if (!blob) throw new Error('Could not convert the image')
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}
