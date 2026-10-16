import { useEffect, useRef } from 'react'
// Renamed so it does not shadow JavaScript's built-in Map
import OlMap from 'ol/Map'
import View from 'ol/View'
import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import { Circle, Fill, Stroke, Style, Text } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import 'ol/ol.css'
import type { LonLat } from '../types/api.ts'

export type MapMarker = {
  id: string
  location: LonLat
  // Short text drawn inside the marker, e.g. "1"
  label: string
}

type MapViewProps = {
  // Only used when the map is first created
  center: LonLat
  zoom: number
  markers?: MapMarker[]
  // The route line in [lon, lat] points, or null for no route
  route?: LonLat[] | null
}

function markerStyle(label: string): Style {
  return new Style({
    image: new Circle({
      radius: 12,
      fill: new Fill({ color: '#1976d2' }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
    text: new Text({
      text: label,
      font: 'bold 12px system-ui, sans-serif',
      fill: new Fill({ color: '#fff' }),
    }),
  })
}

const routeStyle = new Style({
  stroke: new Stroke({ color: '#1976d2', width: 4 }),
})

// Space between the route and the map edge when zooming to fit it
const FIT_PADDING = [40, 40, 40, 40]

// The OpenLayers map is created once. Markers and the route live in their
// own vector sources, which are refilled whenever those props change, so
// the map itself (and the user's zoom/pan) is not rebuilt each time.
function MapView({ center, zoom, markers = [], route = null }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<OlMap | null>(null)
  const markerSourceRef = useRef<VectorSource | null>(null)
  const routeSourceRef = useRef<VectorSource | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const markerSource = new VectorSource()
    const routeSource = new VectorSource()
    const map = new OlMap({
      target: containerRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        // Route first so the markers are drawn on top of the line
        new VectorLayer({ source: routeSource, style: routeStyle }),
        new VectorLayer({ source: markerSource }),
      ],
      // OpenLayers works in Web Mercator meters, so lon/lat is converted
      // here at the edge with fromLonLat and nowhere else
      view: new View({ center: fromLonLat(center), zoom }),
    })

    mapRef.current = map
    markerSourceRef.current = markerSource
    routeSourceRef.current = routeSource

    // Detach the map on unmount. Without this, StrictMode's double mount
    // in development leaves two maps stacked in the same div.
    return () => map.setTarget(undefined)
    // Deliberately empty: the map is created once, and center/zoom are
    // only the starting view
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const source = markerSourceRef.current
    if (!source) return

    source.clear()
    source.addFeatures(
      markers.map((marker) => {
        const feature = new Feature(new Point(fromLonLat(marker.location)))
        feature.setStyle(markerStyle(marker.label))
        return feature
      }),
    )
  }, [markers])

  useEffect(() => {
    const source = routeSourceRef.current
    const map = mapRef.current
    if (!source || !map) return

    source.clear()
    if (!route || route.length < 2) return

    const line = new LineString(route.map((point) => fromLonLat(point)))
    source.addFeature(new Feature(line))
    // Zoom and pan so the whole route is visible
    map.getView().fit(line.getExtent(), { padding: FIT_PADDING })
  }, [route])

  return <div ref={containerRef} className="map" tabIndex={0} />
}

export default MapView
