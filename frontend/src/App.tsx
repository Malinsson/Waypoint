import { Route, Routes } from 'react-router-dom'
import Header from './components/Header/Header.tsx'
import HomePage from './pages/Home/HomePage.tsx'
import LoginPage from './pages/Login/LoginPage.tsx'
import PlanPage from './pages/Plan/PlanPage.tsx'
import RegisterPage from './pages/Register/RegisterPage.tsx'

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
        </Routes>
      </main>
    </>
  )
}

export default App
