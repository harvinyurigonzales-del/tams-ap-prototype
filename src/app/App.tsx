import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from '../ui/Toaster'
import { AdminRoutes } from '../features/admin/AdminRoutes'
import { CustomerRoutes } from '../features/customer/CustomerRoutes'
import { Login } from '../features/customer/Auth'
import { useWorkspace, workspaceHome } from '../state/auth'
import { NotFound } from './NotFound'
import { Presenter } from './Presenter'

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
        <Route path="/" element={<Root />} />
        <Route path="/login" element={<div className="theme-tara min-h-dvh"><Login /></div>} />
        <Route path="/presenter" element={<Presenter />} />
        <Route path="/app/*" element={<CustomerRoutes />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </>
  )
}

/** The site opens on the customer Home page; a signed-in staff member goes to the staff portal instead. */
function Root() {
  const w = useWorkspace()
  return <Navigate to={w ? workspaceHome(w) : '/app'} replace />
}
