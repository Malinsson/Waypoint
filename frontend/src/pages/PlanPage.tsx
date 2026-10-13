import MapView from '../components/MapView.tsx'

const stockholm = { lon: 18.07, lat: 59.33 }

function PlanPage() {
  return (
    <>
      <h1>Plan a trip</h1>
      {/* Centered roughly on the middle of Sweden so the whole country fits */}
      <MapView center={[16.5, 62.5]} zoom={5} markers={[stockholm]} />
    </>
  )
}

export default PlanPage
