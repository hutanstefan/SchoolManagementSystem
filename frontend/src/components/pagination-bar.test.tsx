import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PaginationBar } from './pagination-bar'

const meta = (page: number, total: number) => ({
  page,
  pageSize: 20,
  total,
  totalPages: Math.ceil(total / 20),
})

describe('PaginationBar', () => {
  it('shows the range and the page', () => {
    render(<PaginationBar meta={meta(2, 45)} onPageChange={vi.fn()} />)
    expect(screen.getByText('21–40 of 45')).toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('goes back to the last page when the current one no longer exists', () => {
    // The only row of page 4 was deleted: 60 rows are 3 pages now.
    const onPageChange = vi.fn()
    render(<PaginationBar meta={meta(4, 60)} onPageChange={onPageChange} />)
    expect(onPageChange).toHaveBeenCalledWith(3)
    expect(screen.queryByText(/of 60/)).not.toBeInTheDocument()
  })
})
