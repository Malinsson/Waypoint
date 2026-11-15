import { useEffect, useRef } from 'react'
// Renamed so it does not shadow JavaScript's built-in Map
import styles from './MapView.module.css'
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
import type { Extent } from 'ol/extent'
import 'ol/ol.css'
import type { LonLat } from '../../types/api.ts'

export type MapMarker = {
  id: string
  location: LonLat
  // Short text drawn inside the marker, e.g. "1"
  label: string
  kind?: 'destination' | 'breakpoint' | 'accommodation'
}

type MapViewProps = {
  // Only used when the map is first created
  center: LonLat
  zoom: number
  markers?: MapMarker[]
  // Id of the marker to draw emphasized, if any
  highlightedMarkerId?: string | null
  // The route line in [lon, lat] points, or null for no route
  route?: LonLat[] | null
  onMarkerClick?: (markerId: string) => void
  // Height covered by something on top of the map (the phone bottom sheet).
  // Fitting keeps markers and route above it.
  bottomInsetPx?: number
}

function markerStyle(label: string, kind: MapMarker['kind'], highlighted = false): Style {
  return new Style({
    // A highlighted marker is bigger, has a dark ring and is drawn above its neighbours
    zIndex: highlighted ? 1 : 0,
    image: new Circle({
      radius: highlighted ? 17 : 12,
      fill: new Fill({
        color: kind === 'accommodation' ? '#2e7d32' : kind === 'breakpoint' ? '#bf360c' : '#1976d2',
      }),
      stroke: highlighted
        ? new Stroke({ color: '#111', width: 4 })
        : new Stroke({ color: '#fff', width: 2 }),
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
const FIT_PADDING_PX = 40
const MAX_INSET_SHARE = 0.6
const MARKER_MAX_ZOOM = 15
// Matches the marker circle (radius 12), so clicks just outside it do nothing
const CLICK_RADIUS_PX = 14

// The OpenLayers map is created once. Markers and the route live in their
// own vector sources, which are refilled whenever those props change, so
// the map itself (and the user's zoom/pan) is not rebuilt each time.
function MapView({
  center,
  zoom,
  markers = [],
  highlightedMarkerId = null,
  route = null,
  onMarkerClick,
  bottomInsetPx = 0,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<OlMap | null>(null)
  const markerSourceRef = useRef<VectorSource | null>(null)
  const routeSourceRef = useRef<VectorSource | null>(null)
  const fittedMarkerKeyRef = useRef('')
  const lastFitRef = useRef<{ extent: Extent; maxZoom?: number } | null>(null)

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
    // A new map has not been zoomed to any markers yet (StrictMode remounts it)
    fittedMarkerKeyRef.current = ''
    markerSourceRef.current = markerSource
    routeSourceRef.current = routeSource

    // OpenLayers only measures its container on load, so a changed size
    // (rotating the phone, the browser toolbar hiding) needs an explicit update
    const resizeObserver = new ResizeObserver(() => {
      map.updateSize()
      // The content was fitted for the old size
      const lastFit = lastFitRef.current
      if (lastFit) refitRef.current(lastFit.extent, lastFit.maxZoom)
    })
    resizeObserver.observe(containerRef.current)

    // Detach the map on unmount. Without this, StrictMode's double mount
    // in development leaves two maps stacked in the same div.
    return () => {
      resizeObserver.disconnect()
      map.setTarget(undefined)
    }
    // Deliberately empty: the map is created once, and center/zoom are
    // only the starting view
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Zooms so the extent fits in the part of the map the bottom sheet does not cover
  function fitTo(extent: Extent, maxZoom?: number) {
    const map = mapRef.current
    if (!map) return
    lastFitRef.current = { extent, maxZoom }
    // Never reserve more than most of the map, or a fully open sheet would zoom far out
    const mapHeight = map.getSize()?.[1] ?? 0
    const bottomPadding = FIT_PADDING_PX + Math.min(bottomInsetPx, mapHeight * MAX_INSET_SHARE)
    map.getView().fit(extent, {
      padding: [FIT_PADDING_PX, FIT_PADDING_PX, bottomPadding, FIT_PADDING_PX],
      maxZoom,
    })
  }

  // The resize observer lives in the effect that creates the map, so it needs
  // a way to reach the newest fitTo (which knows the current bottom inset)
  const refitRef = useRef(fitTo)
  useEffect(() => {
    refitRef.current = fitTo
  })

  // When the sheet moves, fit the same content again into the new free space
  useEffect(() => {
    if (lastFitRef.current) fitTo(lastFitRef.current.extent, lastFitRef.current.maxZoom)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomInsetPx])

  useEffect(() => {
    const source = markerSourceRef.current
    const map = mapRef.current
    if (!source || !map) return

    source.clear()
    source.addFeatures(
      markers.map((marker) => {
        const feature = new Feature(new Point(fromLonLat(marker.location)))
        feature.setId(marker.id)
        feature.set('markerId', marker.id)
        return feature
      }),
    )

    // Only zoom when the markers themselves moved. The markers array is also
    // rebuilt when the user picks a place, and that must not reset the view.
    const markerKey = markers.map((marker) => `${marker.id}@${marker.location.join(',')}`).join('|')
    if (markerKey === fittedMarkerKeyRef.current) return
    fittedMarkerKeyRef.current = markerKey

    const markerExtent = source.getExtent()
    if (markers.length > 0 && markerExtent) fitTo(markerExtent, MARKER_MAX_ZOOM)
    // fitTo only reads refs, so it is safe to leave out of the dependencies
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [markers])

  // Styling lives in its own effect so a changed highlight only restyles the
  // markers. It also runs after the effect above, which creates fresh features.
  useEffect(() => {
    markers.forEach((marker) => {
      markerSourceRef.current
        ?.getFeatureById(marker.id)
        ?.setStyle(markerStyle(marker.label, marker.kind, marker.id === highlightedMarkerId))
    })
  }, [markers, highlightedMarkerId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !onMarkerClick) return

    // Finds the marker by distance instead of forEachFeatureAtPixel, which reads
    // pixels back from a canvas and makes the browser log a willReadFrequently warning
    const handleClick = (event: { coordinate: number[]; pixel: number[] }) => {
      const feature = markerSourceRef.current?.getClosestFeatureToCoordinate(event.coordinate)
      const geometry = feature?.getGeometry()
      if (!feature || !(geometry instanceof Point)) return

      const markerPixel = map.getPixelFromCoordinate(geometry.getCoordinates())
      const distance = Math.hypot(markerPixel[0] - event.pixel[0], markerPixel[1] - event.pixel[1])
      const markerId = feature.get('markerId')
      if (distance <= CLICK_RADIUS_PX && typeof markerId === 'string') onMarkerClick(markerId)
    }

    map.on('click', handleClick)
    return () => map.un('click', handleClick)
  }, [onMarkerClick])

  useEffect(() => {
    const source = routeSourceRef.current
    const map = mapRef.current
    if (!source || !map) return

    source.clear()
    if (!route || route.length < 2) return

    const line = new LineString(route.map((point) => fromLonLat(point)))
    source.addFeature(new Feature(line))
    // Zoom and pan so the whole route is visible
    fitTo(line.getExtent())
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [route])

  // The map is focusable so the arrow keys can pan it. The markers can only be
  // clicked, but every stop is also listed as text next to the map.
  return <div ref={containerRef} className={styles.map} tabIndex={0} role="region" aria-label="Route map" />
}

export default MapView
