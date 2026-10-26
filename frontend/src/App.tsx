import { Route, Routes } from 'react-router-dom'
import AppLayout from './AppLayout.tsx'
import TripsPage from './pages/Trips/TripsPage.tsx'
import Header from './components/Header/Header.tsx'
import HomePage from './pages/Home/HomePage.tsx'
import LoginPage from './pages/Login/LoginPage.tsx'
import PlanPage from './pages/Plan/PlanPage.tsx'
import RegisterPage from './pages/Register/RegisterPage.tsx'
import FavoritePage from './pages/Favorite/FavoritePage.tsx'
import RequireAuth from './components/RequireAuth/RequireAuth.tsx'
import Footer from './components/Footer/Footer.tsx'
import MobileNavigation from './components/MobileNavigation/MobileNavigation.tsx'
import TripDetailPage from './pages/TripDetail/TripDetail.tsx'

function App() {



  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route element={ <RequireAuth><AppLayout /></RequireAuth> }>
            <Route path="/favorites" element={<FavoritePage />} />
            <Route path="/trips" element={<TripsPage />} />
            <Route path="/trips/:id" element={<TripDetailPage />} />
          </Route>

        </Routes>
      </main>
      <MobileNavigation />
      <Footer />
    </>
  )
}

export default App
