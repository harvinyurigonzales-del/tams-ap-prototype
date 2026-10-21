import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { UpdatePrompt } from '../pwa/UpdatePrompt'
import { Toaster } from '../ui/Toaster'
import { AdminRoutes } from '../features/admin/AdminRoutes'
import { CustomerRoutes } from '../features/customer/CustomerRoutes'
import { NotFound } from './NotFound'
import { Start } from './Start'

export function App() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return (
    <>
      <Routes>
        <Route path="/" element={<Start />} />
        <Route path="/app/*" element={<CustomerRoutes />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
      <UpdatePrompt />
    </>
  )
}
