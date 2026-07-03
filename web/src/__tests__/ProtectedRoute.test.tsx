import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'

const mockGetProfile = vi.fn()

vi.mock('../services/auth', () => ({
  authService: {
    getProfile: (...args: any[]) => mockGetProfile(...args),
  },
}))

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Protected Content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('redirects to login when not authenticated', async () => {
    mockGetProfile.mockRejectedValue(new Error('No token'))
    renderApp()
    expect(await screen.findByText('Login Page')).toBeInTheDocument()
  })

  it('renders children when authenticated', async () => {
    mockGetProfile.mockResolvedValue({ id: '1', name: 'Test User', email: 'test@example.com' })
    localStorage.setItem('token', 'valid-token')
    renderApp()
    expect(await screen.findByText('Protected Content')).toBeInTheDocument()
  })
})
