import { useEffect, useRef } from 'react'
// Renamed so it does not shadow JavaScript's built-in Map
import OlMap from 'ol/Map'
import View from 'ol/View'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import { Circle, Fill, Stroke, Style } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import 'ol/ol.css'

type MapMarker = {
  lon: number
  lat: number
}

type MapViewProps = {
  center: [lon: number, lat: number]
  zoom: number
  markers?: MapMarker[]
}

const markerStyle = new Style({
  image: new Circle({
    radius: 8,
    fill: new Fill({ color: '#1976d2' }),
    stroke: new Stroke({ color: '#fff', width: 2 }),
  }),
})

// The map is created once on mount. Later changes to the props are not
// applied yet; that will be added when the map needs to show routes.
function MapView({ center, zoom, markers = [] }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // OpenLayers works in Web Mercator meters, so lon/lat is converted
    // here at the edge with fromLonLat and nowhere else
    const markerFeatures = markers.map(
      (marker) => new Feature(new Point(fromLonLat([marker.lon, marker.lat]))),
    )

    const map = new OlMap({
      target: containerRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        new VectorLayer({
          source: new VectorSource({ features: markerFeatures }),
          style: markerStyle,
        }),
      ],
      view: new View({ center: fromLonLat(center), zoom }),
    })

    // Detach the map on unmount. Without this, StrictMode's double mount
    // in development leaves two maps stacked in the same div.
    return () => map.setTarget(undefined)
    // Deliberately empty: the map is created once (see comment above MapView)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="map" />
}

export default MapView
