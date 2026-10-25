import type { ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { NotFound } from '../../app/NotFound'
import { useWorkspace } from '../../state/auth'
import { Account, Notifications } from './Account'
import { ForgotPassword, Login, Signup } from './Auth'
import { BookingForm, BookingReceived } from './Book'
import { ChooseDate } from './ChooseDate'
import { CustomRequestDetails, CustomRequestForm } from './Custom'
import { DestinationDetails } from './Destinations'
import { ExplorePage } from './Explore'
import { Home } from './Home'
import { Shell } from './Layout'
import { Messages, MessageThread } from './Messages'
import { Pay } from './Pay'
import { Preferences } from './Preferences'
import { RentalLanding, RentalRequestDetails, RentalRequestForm } from './Rental'
import { ReviewsPage } from './Reviews'
import { Saved } from './Saved'
import { TourDetails } from './Tours'
import { PhotoCredits } from './Credits'
import { Planner } from './planner/Planner'
import { justSignedOut } from '../../state/persist'
import { TripDetails, Trips } from './Trips'

export function CustomerRoutes() {
  return (
    <Routes>
      <Route path="login" element={<Bare><Login /></Bare>} />
      <Route path="signup" element={<Bare><Signup /></Bare>} />
      <Route path="forgot" element={<Bare><ForgotPassword /></Bare>} />
      <Route element={<Shell />}>
        {/* Guests can browse everything here and fill in request forms; sending one asks them to log in. */}
        <Route index element={<Home />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="tours" element={<ExplorePage defaultView="tours" />} />
        <Route path="tours/:serviceId" element={<TourDetails />} />
        <Route path="tours/:serviceId/dates" element={<ChooseDate />} />
        <Route path="destinations" element={<ExplorePage defaultView="destinations" />} />
        <Route path="destinations/:destinationId" element={<DestinationDetails />} />
        <Route path="rental" element={<RentalLanding />} />
        <Route path="rental/request" element={<RentalRequestForm />} />
        <Route path="custom/new" element={<Planner />} />
        <Route path="custom/form" element={<CustomRequestForm />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="credits" element={<PhotoCredits />} />

        {/* Old links from the first version of the prototype. */}
        <Route path="services" element={<Navigate to="/app/tours" replace />} />
        <Route path="services/:serviceId/*" element={<LegacyService />} />
        <Route path="rent" element={<Navigate to="/app/rental/request" replace />} />
        <Route path="inquiries" element={<Navigate to="/app/messages" replace />} />

        <Route element={<RequireCustomer />}>
          <Route path="book/:departureId" element={<BookingForm />} />
          <Route path="booked/:bookingId" element={<BookingReceived />} />
          <Route path="trips" element={<Trips />} />
          <Route path="trips/:bookingId" element={<TripDetails />} />
          <Route path="trips/:bookingId/pay" element={<Pay />} />
          <Route path="custom/:requestId" element={<CustomRequestDetails />} />
          <Route path="rentals/:requestId" element={<RentalRequestDetails />} />
          <Route path="saved" element={<Saved />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:inquiryId" element={<MessageThread />} />
          <Route path="preferences" element={<Preferences />} />
          <Route path="account" element={<Account />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        <Route path="*" element={<NotFound home="/app" homeLabel="Back to Home" />} />
      </Route>
    </Routes>
  )
}

/** /app/services/:id(/dates) → the tour page, or van rental for the old van service. */
function LegacyService() {
  const { serviceId, '*': rest } = useParams()
  if (serviceId === 'SVC-VAN') return <Navigate to="/app/rental" replace />
  return <Navigate to={`/app/tours/${serviceId}${rest ? `/${rest}` : ''}`} replace />
}

/**
 * Customer-only pages. Guests are asked to log in and come back; a signed-in staff member goes to the staff
 * portal. This shows intended behaviour only; real access control belongs on a server.
 */
function RequireCustomer() {
  const workspace = useWorkspace()
  const loc = useLocation()
  if (workspace === 'staff') return <Navigate to="/admin" replace />
  if (!workspace) return <Navigate to={justSignedOut() ? '/app' : `/app/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <Outlet />
}

function Bare({ children }: { children: ReactNode }) {
  return (
    <div className="theme-tara min-h-dvh">
      {children}
    </div>
  )
}
