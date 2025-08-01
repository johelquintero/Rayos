# Mapa de Rayos en Tiempo Real - Venezuela (v2)

Este proyecto muestra un mapa de Venezuela con la ubicación de los rayos en tiempo real, actualizándose automáticamente cada 5 minutos. Los datos son obtenidos del sitio web Meteologix.

## Funcionamiento

El mapa utiliza la librería [Leaflet.js](https://leafletjs.com/) para visualizar los datos geoespaciales. La lógica principal se encuentra en el archivo `script.js`.

### 1. Obtención de Datos (Scraping)

Los datos de los rayos no se obtienen de una API pública, sino directamente de la página de Meteologix. Se realiza un proceso de *scraping* para extraer la información de los rayos desde el HTML de la página.

Para evitar problemas de CORS (Cross-Origin Resource Sharing) al hacer la solicitud desde el navegador, se utiliza un proxy. En este caso, `https://api.allorigins.win/`.

La URL de Meteologix se construye dinámicamente para obtener los datos más recientes. La página genera los datos en intervalos de 5 minutos, por lo que el script calcula el tiempo UTC actual y lo redondea al intervalo de 5 minutos más cercano para construir la URL correcta.

### 2. Procesamiento de Datos

Una vez que se recibe el contenido HTML de la página de Meteologix a través del proxy, se utiliza `DOMParser` para convertir el texto HTML en un documento DOM que se puede manipular con JavaScript.

Se buscan todos los elementos `<span>` que contienen la información de los rayos. Estos elementos tienen la clase `ap lgt`.

Cada `<span>` del rayo contiene:
*   `data-top`: La coordenada Y del rayo en el mapa.
*   `data-left`: La coordenada X del rayo en el mapa.
*   Una clase `lgt-X`: Donde `X` es un índice que representa la antigüedad del rayo.

### 3. Visualización en el Mapa

Con las coordenadas (X, Y) y la antigüedad, se crea un marcador personalizado en el mapa para cada rayo.

*   **Icono:** Se utiliza un ícono de rayo (⚡️).
*   **Color:** El color del ícono se determina por su antigüedad, usando la función `getColor()`. Los rayos más recientes son rojos y se van enfriando a naranja, amarillo y azul a medida que envejecen.
*   **Actualización:** El mapa se actualiza cada 5 minutos (300,000 milisegundos) para obtener y mostrar los datos más recientes.

## Código Relevante

A continuación se muestra el fragmento de código clave de `script.js` responsable de la obtención y visualización de los datos.

```javascript
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -5
});

const bounds = [[0,0], [800,800]];
const imageUrl = 'https://osm.meteologix.com/custom/no_overlays/1400/1433.png';

L.imageOverlay(imageUrl, bounds).addTo(map);

map.fitBounds(bounds);

let lightningLayer = L.layerGroup().addTo(map);

function getColor(age) { // age is an index from 0 to 11, representing 5-minute intervals
    if (age <= 1) return '#ff0000';    // 0-10 min (Rojo Intenso)
    if (age <= 3) return '#ff9900';    // 10-20 min (Naranja)
    if (age <= 6) return '#ffff00';    // 20-35 min (Amarillo)
    if (age <= 9) return '#ffffff';    // 35-50 min (Blanco)
    return '#87CEEB';                  // 50-60 min (Azul claro)
}

function fetchData() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = now.getUTCDate().toString().padStart(2, '0');
    const hours = now.getUTCHours().toString().padStart(2, '0');
    const roundedMinutes = (Math.floor(now.getUTCMinutes() / 5) * 5).toString().padStart(2, '0');
    const timestamp = `${year}${month}${day}-${hours}${roundedMinutes}z`;

    const proxyUrl = 'https://api.allorigins.win/get?url=';
    const apiUrl = `https://meteologix.com/ve/lightning/venezuela/${timestamp}.html`;

    fetch(proxyUrl + encodeURIComponent(apiUrl))
        .then(response => response.json())
        .then(data => {
            lightningLayer.clearLayers();
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            const lightningSpans = doc.querySelectorAll('.ap.lgt');

            lightningSpans.forEach(span => {
                const y = span.dataset.top;
                const x = span.dataset.left;
                const ageClass = Array.from(span.classList).find(c => c.startsWith('lgt-'));
                const age = parseInt(ageClass.split('-')[1]);
                
                const color = getColor(age);
                const customIcon = L.divIcon({
                    className: 'lightning-icon',
                    html: `<span style="color: ${color};">⚡️</span>`,
                    iconSize: [15, 15]
                });

                L.marker([y, x], { icon: customIcon }).addTo(lightningLayer);
            });
        })
        .catch(error => console.error('Error al obtener los datos:', error));
}

fetchData();
setInterval(fetchData, 300000); // 300000 ms = 5 minutes