import { Route, Routes } from 'react-router-dom'
import Header from './components/Header/Header.tsx'
import HomePage from './pages/HomePage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import PlanPage from './pages/PlanPage.tsx'
import RegisterPage from './pages/RegisterPage.tsx'

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
