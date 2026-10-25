import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import { lectureLink } from './api'

/** Saves the PDF: the link answers with "attachment", so the page stays. */
export async function downloadLecture(id: string): Promise<void> {
  try {
    const { url } = await lectureLink(id, true)
    window.location.assign(url)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

/**
 * Opens the PDF in a new tab (the browser's own viewer). The tab is opened
 * right away, during the click, so pop-up blockers allow it; the link
 * follows a moment later.
 */
export async function openLectureInNewTab(id: string): Promise<void> {
  const tab = window.open('', '_blank')
  try {
    const { url } = await lectureLink(id)
    if (tab) tab.location.href = url
    else window.location.assign(url)
  } catch (error) {
    tab?.close()
    toast.error(errorMessage(error))
  }
}

/** Phones have no PDF viewer for iframes: they get a new tab instead. */
export function canPreviewInline(): boolean {
  return !window.matchMedia?.('(max-width: 767px)').matches
}
