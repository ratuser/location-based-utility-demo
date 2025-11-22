function showSpinner() {
  document.getElementById('spinner').classList.remove('hidden');
}

function hideSpinner() {
  document.getElementById('spinner').classList.add('hidden');
}

const geoapifyApiKey = '717b4d529efc4f34979f9cd8b1eb1d2d';

let map, markersLayer;
let currentCategory = 'service.financial.atm';
const radius = 5000;

// Geocode search bar
async function geocode(query) {
  showSpinner();
  const res = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&apiKey=${geoapifyApiKey}`);
  const data = await res.json();
  hideSpinner();
  return data.results?.[0];
}

// Fetch places → plot markers on map
async function fetchAndPlotPlaces(lat, lon) {
  showSpinner();
  markersLayer.clearLayers();

  try {
    const url = `https://api.geoapify.com/v2/places?categories=${currentCategory}&filter=circle:${lon},${lat},${radius}&limit=10&apiKey=${geoapifyApiKey}`;
    const places = await (await fetch(url)).json();
    console.log('Places:', places);

    if (places.features?.length) {
      places.features.forEach(f => {
        const [lng, la] = f.geometry.coordinates;
        const props = f.properties;
        const name = props.name || 'Unnamed';
        const addr = props.address_line1 || props.formatted || 'No address';

        // Plot marker
        L.marker([la, lng]).addTo(markersLayer)
          .bindPopup(`<strong>${name}</strong><br>${addr}`);
      });
    } else {
      alert('No places found for this category in your area.');
    }

  } catch (error) {
    console.error('Failed to fetch places:', error);
    alert('Something went wrong while loading places.');
  } finally {
    hideSpinner();
  }
}

// Initialize map and find user location
async function initMap() {
  function getLocationByIP() {
    return fetch('https://ipinfo.io/json')
      .then(res => res.json())
      .then(data => data.loc.split(',').map(Number));
  }

  function getLocationByBrowser() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocation not supported');
      } else {
        navigator.geolocation.getCurrentPosition(
          pos => resolve([pos.coords.latitude, pos.coords.longitude]),
          err => reject(err)
        );
      }
    });
  }

  let lat, lon;

  // Try GPS → fallback to IP
  try {
    [lat, lon] = await getLocationByBrowser();
  } catch (err) {
    console.warn('GPS denied, falling back to IP:', err);
    [lat, lon] = await getLocationByIP();
  }

  map.setView([lat, lon], 13);

  // Reverse geocode for address
  const reverseUrl = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${geoapifyApiKey}`;
  const reverseRes = await fetch(reverseUrl);
  const reverseData = await reverseRes.json();

  let userAddress = 'Your approximate location';
  if (reverseData.features?.length) {
    userAddress = reverseData.features[0].properties.formatted;
  }

  L.marker([lat, lon]).addTo(map).bindPopup(`<strong>Your Location</strong><br>${userAddress}`).openPopup();

  await fetchAndPlotPlaces(lat, lon);
}

// DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  map = L.map('map').setView([0, 0], 2);
  markersLayer = L.layerGroup().addTo(map);

  // Satellite tiles
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri', maxZoom: 18
  }).addTo(map);

  await initMap();

  // Category filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentCategory = btn.getAttribute('data-cat');
      const center = map.getCenter();
      await fetchAndPlotPlaces(center.lat, center.lng);
    });
  });

  
  // document.getElementById('location-go').addEventListener('click', async () => {
  //   const query = document.getElementById('location-search').value;
  //   if (!query.trim()) return;

  //   const loc = await geocode(query);
  //   if (loc) {
  //     const {lat, lon} = loc;
  //     map.setView([lat, lon], 13);

  //     L.marker([lat, lon]).addTo(markersLayer).bindPopup(loc.formatted).openPopup();

  //     await fetchAndPlotPlaces(lat, lon);
  //   } else {
  //     alert('Location not found!');
  //   }
  // });
});
