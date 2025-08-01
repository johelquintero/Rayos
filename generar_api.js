const axios = require('axios');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

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
    return { lat, lng };
}

async function generarDatosDeRayos() {
    console.log('Iniciando la generación de datos de rayos...');

    try {
        // 1. Obtener el timestamp actual en el formato correcto
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = now.getUTCDate().toString().padStart(2, '0');
        const hours = now.getUTCHours().toString().padStart(2, '0');
        const roundedMinutes = (Math.floor(now.getUTCMinutes() / 5) * 5).toString().padStart(2, '0');
        const timestamp = `${year}${month}${day}-${hours}${roundedMinutes}z`;

        // 2. Descargar el HTML de Meteologix a través del proxy
        const meteologixUrl = `https://meteologix.com/ve/lightning/venezuela/${timestamp}.html`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(meteologixUrl)}`;
        
        console.log(`Descargando datos a través del proxy: ${proxyUrl}`);
        const response = await axios.get(proxyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
            }
        });
        const html = response.data.contents;

        // 3. Procesar el HTML para extraer los datos de los rayos
        const dom = new JSDOM(html);
        const lightningSpans = dom.window.document.querySelectorAll('.ap.lgt');
        console.log(`Se encontraron ${lightningSpans.length} elementos de rayos.`);

        const datosRayos = [];
        lightningSpans.forEach(span => {
            const pixelY = parseFloat(span.dataset.top);
            const pixelX = parseFloat(span.dataset.left);
            const ageClass = Array.from(span.classList).find(c => c.startsWith('lgt-'));
            const age = ageClass ? parseInt(ageClass.split('-')[1]) : 0;

            if (!isNaN(pixelX) && !isNaN(pixelY)) {
                const { lat, lng } = pixelToLatLng(pixelX, pixelY);
                datosRayos.push({
                    lat: parseFloat(lat.toFixed(4)),
                    lng: parseFloat(lng.toFixed(4)),
                    age: age * 5 // Edad en minutos
                });
            }
        });

        // 4. Guardar los datos en un archivo JSON
        const outputPath = path.join(__dirname, 'api', 'datos_rayos.json');
        const outputDir = path.dirname(outputPath);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(datosRayos, null, 2));
        console.log(`Datos guardados exitosamente en: ${outputPath}`);
        console.log(`Total de rayos procesados y guardados: ${datosRayos.length}`);

    } catch (error) {
        console.error('Ocurrió un error durante la generación de datos:', error.message);
    }
}

generarDatosDeRayos();