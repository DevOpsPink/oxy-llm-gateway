import { render, screen } from '@testing-library/react'
import { FoundersSection } from './founders-section'

describe('FoundersSection', () => {
  it('credits both co-authors without audience or credential numbers', () => {
    const { container } = render(<FoundersSection />)

    expect(screen.getByText(/Vladimir Mikhalev/i)).toBeInTheDocument()
    expect(screen.getByText(/Tatiana Mikhaleva/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Co-author/i).length).toBeGreaterThanOrEqual(2)

    const text = container.textContent || ''
    expect(text).not.toMatch(/\d+K\+/)
    expect(text).not.toMatch(/followers|ambassador/i)
  })
})
