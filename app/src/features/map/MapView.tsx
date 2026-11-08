import { useCallback, useEffect, useState } from 'react';
import { CONFIG } from '../../lib/config';
import { setState } from '../../lib/store';
import { GoogleMapView } from './GoogleMapView';
import { LeafletMapView } from './LeafletMapView';

/** Carte Google (trafic en temps réel) si une clé est configurée, sinon carte OpenStreetMap. */
export function MapView() {
  const [provider, setProvider] = useState<'google' | 'leaflet'>(CONFIG.googleMapsKey ? 'google' : 'leaflet');
  useEffect(() => { setState({ mapProvider: provider }); }, [provider]);
  const fallback = useCallback(() => {
    console.warn('Google Maps indisponible : passage sur la carte OpenStreetMap');
    setProvider('leaflet');
  }, []);
  return provider === 'google'
    ? <GoogleMapView apiKey={CONFIG.googleMapsKey} onFail={fallback} />
    : <LeafletMapView />;
}
