// =================================================================================
// CONFIGURACIÓN DEL MAPA Y LA IMAGEN DE REFERENCIA
// =================================================================================

// Coordenadas iniciales y zoom para Venezuela
const initialCoords = [8.0, -66.0];
const initialZoom = 5;

// Crear el mapa de Leaflet
const map = L.map('map').setView(initialCoords, initialZoom);

// Capa de mapa de satélite híbrido
L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3'],
    attribution: '© Google'
}).addTo(map);

// Configuración de calibración guardada para la imagen de referencia
const imageConfig = {
    bounds: {
        north: 14.8,
        south: -3.9,
        west: -75.5,
        east: -56.5
    },
    opacity: 0.7 // Puedes ajustar la opacidad aquí (0.0 a 1.0)
};

let lightningLayer = L.layerGroup().addTo(map);

function getColor(age) {
    // Ajustar colores según la documentación de Meteologix
    if (age <= 1) return '#ff0000';    // 0-5 min (Rojo)
    if (age <= 3) return '#ff6600';    // 5-15 min (Naranja)
    if (age <= 6) return '#ffff00';    // 15-30 min (Amarillo)
    if (age <= 9) return '#ffffff';    // 30-45 min (Blanco)
    return '#87CEEB';                  // 45-60 min (Azul claro)
}

// Límites de calibración que encontraste
const calibrationBounds = {
    north: 14.2,
    south: 0.2,
    west: -75.8,
    east: -54.9
};

// Dimensiones del mapa de origen
const mapWidth = 800;
const mapHeight = 600;

// Función para transformar coordenadas de píxeles a lat/lng
function pixelToLatLng(x, y) {
    const lat = calibrationBounds.north - (y / mapHeight) * (calibrationBounds.north - calibrationBounds.south);
    const lng = calibrationBounds.west + (x / mapWidth) * (calibrationBounds.east - calibrationBounds.west);
    return [lat, lng];
}

function updateStatus(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.innerHTML = message;
    }
}

function fetchData() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = now.getUTCDate().toString().padStart(2, '0');
    const hours = now.getUTCHours().toString().padStart(2, '0');
    const roundedMinutes = (Math.floor(now.getUTCMinutes() / 5) * 5).toString().padStart(2, '0');
    const timestamp = `${year}${month}${day}-${hours}${roundedMinutes}z`;
    
    updateStatus(`Buscando datos para: ${timestamp}`);
    const proxyUrl = 'https://api.allorigins.win/get?url=';
    const apiUrl = `https://meteologix.com/ve/lightning/venezuela/${timestamp}.html`;
    
    fetch(proxyUrl + encodeURIComponent(apiUrl))
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            lightningLayer.clearLayers();
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            const lightningSpans = doc.querySelectorAll('.ap.lgt');
            let rayosValidos = 0;

            lightningSpans.forEach(span => {
                const pixelY = parseFloat(span.dataset.top);
                const pixelX = parseFloat(span.dataset.left);
                
                if (!isNaN(pixelX) && !isNaN(pixelY)) {
                    const [lat, lng] = pixelToLatLng(pixelX, pixelY);
                    
                    if (lat >= calibrationBounds.south && lat <= calibrationBounds.north && lng >= calibrationBounds.west && lng <= calibrationBounds.east) {
                        rayosValidos++;
                        const ageClass = Array.from(span.classList).find(c => c.startsWith('lgt-'));
                        const age = ageClass ? parseInt(ageClass.split('-')[1]) : 0;
                        let customIcon;

                        if (age <= 1) { // 0-5 minutos
                            customIcon = L.icon({
                                iconUrl: 'icons/lightning-5-minutos.svg',
                                iconSize: [25, 25],
                                iconAnchor: [12, 12]
                            });
                        } else {
                            const color = getColor(age);
                            customIcon = L.divIcon({
                                className: 'lightning-icon',
                                html: `<span style="color: ${color}; font-size: 20px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">⚡️</span>`,
                                iconSize: [25, 25],
                                iconAnchor: [12, 12]
                            });
                        }

                        L.marker([lat, lng], { icon: customIcon })
                            .bindPopup(`<strong>⚡ Rayo detectado</strong><br><strong>Edad:</strong> ${age * 5} minutos<br><strong>Coordenadas:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
                            .addTo(lightningLayer);
                    }
                }
            });

            const statusMessage = `
                <strong>Última actualización:</strong> ${new Date().toLocaleTimeString()}<br>
                <strong>Timestamp:</strong> ${timestamp}<br>
                <strong>Rayos encontrados:</strong> ${lightningSpans.length}<br>
                <strong>Rayos válidos:</strong> ${rayosValidos}
            `;
            updateStatus(statusMessage);
        })
        .catch(error => {
            console.error('Error al obtener los datos:', error);
            updateStatus(`<span style="color: red;">Error al cargar datos: ${error.message}</span>`);
        });
}

function init() {
    console.log('Inicializando mapa de rayos (versión original).');
    const { north, south, east, west } = imageConfig.bounds;
    const imageBounds = [[north, west], [south, east]];

    const referenceOverlay = L.imageOverlay('icons/mapa.png', imageBounds, {
        opacity: imageConfig.opacity,
        interactive: false
    }).addTo(map);

    L.control.layers(null, { "Imagen de Referencia": referenceOverlay }).addTo(map);
    
    fetchData();
    setInterval(fetchData, 300000);
    
    const updateButton = L.control({position: 'topleft'});
    updateButton.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        div.innerHTML = '<button onclick="fetchData()" style="background: white; border: none; padding: 5px 10px; cursor: pointer;">🔄 Actualizar</button>';
        return div;
    };
    updateButton.addTo(map);

    // --- LÓGICA DEL RADAR ANIMADO ---
    var radarLayers = [];
    var radarAnimation;
    var currentRadarLayer = 0;

    function addRadarLayer() {
        fetch('https://api.rainviewer.com/public/weather-maps.json')
            .then(res => res.json())
            .then(apiData => {
                apiData.radar.nowcast.forEach(frame => {
                    const radarLayer = L.tileLayer(apiData.host + frame.path + `/512/{z}/{x}/{y}/${apiData.radar.colorScheme}/${apiData.radar.smooth}.png`, {
                        tileSize: 512,
                        opacity: 0.7,
                        zIndex: 9999 // Aumentar zIndex para asegurar visibilidad
                    });
                    radarLayers.push(radarLayer);
                });

                // Iniciar animación
                function showRadarFrame(frameIndex) {
                    // Ocultar todas las capas
                    // Ocultar la capa anterior
                    var previousFrameIndex = (frameIndex + radarLayers.length - 1) % radarLayers.length;
                    map.removeLayer(radarLayers[previousFrameIndex]);
                    
                    // Mostrar la capa actual
                    radarLayers[frameIndex].addTo(map);
                }

                var currentFrame = 0;
                radarAnimation = setInterval(() => {
                    if (currentFrame >= radarLayers.length) {
                        currentFrame = 0;
                    }
                    showRadarFrame(currentFrame);
                    currentFrame++;
                }, 500);
            })
            .catch(console.error);
    }

    function removeRadarLayer() {
        clearInterval(radarAnimation);
        radarLayers.forEach(layer => map.removeLayer(layer));
        radarLayers = [];
        currentRadarLayer = 0;
    }

    var radarControl = L.control.layers(null, {
        'Radar Animado': L.layerGroup() // Capa ficticia para el control
    }, { collapsed: false });
    radarControl.addTo(map);

    map.on('overlayadd', function(e) {
        if (e.name === 'Radar Animado') {
            addRadarLayer();
        }
    });

    map.on('overlayremove', function(e) {
        if (e.name === 'Radar Animado') {
            removeRadarLayer();
        }
    });
}

document.addEventListener('DOMContentLoaded', init);