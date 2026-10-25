import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from '../ui/Toaster'
import { AdminRoutes } from '../features/admin/AdminRoutes'
import { CustomerRoutes } from '../features/customer/CustomerRoutes'
import { NotFound } from './NotFound'
import { Start } from './Start'

export function App() {
  const { pathname } = useLocation()
  // Block body on purpose: some browser extensions patch scrollTo to return a value, and React would then
  // treat that value as a cleanup function and crash on the next navigation.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <>
      <Routes>
        <Route path="/" element={<Start />} />
        <Route path="/app/*" element={<CustomerRoutes />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </>
  )
}
