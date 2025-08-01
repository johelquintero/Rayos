// =================================================================================
// CONFIGURACIÓN DEL MAPA
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

// Capa para los marcadores de rayos
let lightningLayer = L.layerGroup().addTo(map);

// Función para asignar un color según la edad del rayo
function getColor(ageInMinutes) {
    const ageCategory = Math.floor(ageInMinutes / 5);
    if (ageCategory <= 1) return '#ff0000';    // 0-5 min (Rojo)
    if (ageCategory <= 3) return '#ff6600';    // 5-15 min (Naranja)
    if (ageCategory <= 6) return '#ffff00';    // 15-30 min (Amarillo)
    if (ageCategory <= 9) return '#ffffff';    // 30-45 min (Blanco)
    return '#87CEEB';                          // 45-60 min (Azul claro)
}

// Función para actualizar el panel de estado
function updateStatus(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.innerHTML = message;
    }
}

// =================================================================================
// LÓGICA PRINCIPAL DE LA APLICACIÓN
// =================================================================================

function fetchData() {
    // URL de la API generada por GitHub Actions
    const apiUrl = 'https://johelquintero.github.io/Rayos/api/datos_rayos.json';
    
    updateStatus('Buscando datos desde la API...');
    console.log(`Solicitando datos desde: ${apiUrl}`);

    // Se añade un timestamp como parámetro para evitar problemas de caché del navegador
    fetch(apiUrl + `?t=${new Date().getTime()}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar la API: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Datos recibidos de la API:', data);
            
            lightningLayer.clearLayers();

            data.forEach(rayo => {
                const color = getColor(rayo.age);
                const customIcon = L.divIcon({
                    className: 'lightning-icon',
                    html: `<span style="color: ${color}; font-size: 20px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">⚡️</span>`,
                    iconSize: [25, 25],
                    iconAnchor: [12, 12]
                });

                L.marker([rayo.lat, rayo.lng], { icon: customIcon })
                    .bindPopup(`
                        <strong>⚡ Rayo detectado</strong><br>
                        <strong>Edad:</strong> ${rayo.age} minutos<br>
                        <strong>Coordenadas:</strong> ${rayo.lat}, ${rayo.lng}
                    `)
                    .addTo(lightningLayer);
            });

            const statusMessage = `
                <strong>Última actualización:</strong> ${new Date().toLocaleTimeString()}<br>
                <strong>Rayos en el mapa:</strong> ${data.length}
            `;
            updateStatus(statusMessage);
            console.log(`Procesamiento completado. ${data.length} rayos dibujados.`);
        })
        .catch(error => {
            console.error('Error al obtener los datos de la API:', error);
            updateStatus(`<span style="color: red;">Error al cargar datos de la API: ${error.message}</span>`);
        });
}

// =================================================================================
// INICIALIZACIÓN
// =================================================================================

function init() {
    console.log('Inicializando mapa de rayos (versión API).');
    
    // Cargar datos inicialmente
    fetchData();
    
    // Actualizar cada 5 minutos (300000 ms)
    setInterval(fetchData, 300000);
    
    // Agregar botón de actualización manual
    const updateButton = L.control({position: 'topleft'});
    updateButton.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        div.innerHTML = '<button onclick="fetchData()" style="background: white; border: none; padding: 5px 10px; cursor: pointer;">🔄 Actualizar</button>';
        return div;
    };
    updateButton.addTo(map);
}

// Inicializar cuando la página esté cargada
document.addEventListener('DOMContentLoaded', init);