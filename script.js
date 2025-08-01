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
let datosParaAPI = []; // Variable global para guardar los datos de los rayos

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
            datosParaAPI = []; // Limpiar los datos anteriores
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
                        const color = getColor(age);
                        const customIcon = L.divIcon({
                            className: 'lightning-icon',
                            html: `<span style="color: ${color}; font-size: 20px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">⚡️</span>`,
                            iconSize: [25, 25],
                            iconAnchor: [12, 12]
                        });

                        // Guardar los datos del rayo en nuestra variable global
                        datosParaAPI.push({
                            lat: parseFloat(lat.toFixed(4)),
                            lng: parseFloat(lng.toFixed(4)),
                            age: age * 5
                        });

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

            // Mostrar el botón de generar API si hay datos
            const generarApiButton = document.getElementById('generar-api');
            if (datosParaAPI.length > 0) {
                generarApiButton.style.display = 'block';
            }
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

    // Lógica para el botón de generar API
    const generarApiButton = document.getElementById('generar-api');
    generarApiButton.addEventListener('click', () => {
        if (datosParaAPI.length === 0) {
            alert('No hay datos de rayos para generar la API. Por favor, espera a que se carguen los datos.');
            return;
        }

        const jsonString = JSON.stringify(datosParaAPI, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'datos_rayos.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

document.addEventListener('DOMContentLoaded', init);