import { NavLink, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage.tsx'
import PlanPage from './pages/PlanPage.tsx'

function App() {
  return (
    <>
      <nav>
        <NavLink to="/">Home</NavLink>
        <NavLink to="/plan">Plan</NavLink>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/plan" element={<PlanPage />} />
        </Routes>
      </main>
    </>
  )
}

export default App
