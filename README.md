# 🌱 Cultivador

**App publicada:** <https://clulloa1983.github.io/cultivador/>

Guía de cultivo y bitácora para la huerta en casa, pensada para usarse en el celular.
El calendario está ajustado a **Penco y la costa del Biobío** (hemisferio sur, clima mediterráneo costero).

Es una aplicación web de una sola página (SPA) hecha con HTML, CSS y JavaScript sin frameworks ni paso de compilación.
Los datos se guardan en el navegador (`localStorage`) y se puede instalar como app (PWA) para usarla sin conexión.

## Funcionalidades

- **Guía de cultivos**: fichas de poroto verde (mata baja y enredadera), tomate, lechuga, zapallo italiano, choclo, cilantro y albahaca. Cada ficha trae:
  - calendario de siembra directa, almácigo y trasplante;
  - profundidad y distancia de siembra;
  - días a germinación, floración y cosecha;
  - necesidades de sol y riego;
  - plantas compañeras e incompatibles;
  - plagas comunes y cómo manejarlas;
  - señales de que está lista para cosechar.

  Destaca lo que se puede sembrar **en el mes actual**.
- **Mis cultivos**:
  - Registra especie, fecha de siembra, método (siembra directa o almácigo, con fecha de trasplante opcional), ubicación (macetero, bancal o suelo) y notas.
  - Muestra la etapa estimada (germinación, almácigo, crecimiento, floración, cosecha) con barra de progreso.
  - Permite editar, archivar (con «Deshacer») y eliminar, con confirmación.
- **Bitácora**:
  - Entradas por cultivo: riego, abono, observación, plaga y cosecha. La cosecha admite cantidad en g, kg, unidades o atados.
  - Vista cronológica con filtros por cultivo y por tipo.
  - Botón **«Regué hoy»** de un toque y **«Regué todos»** en el inicio.
- **Inicio**: cultivos activos, máximo de días sin regar (con aviso si toca regar), próximas cosechas y qué sembrar este mes.
- **Respaldo**: descarga e importación de todos los datos en JSON, con validación. Se puede combinar con los datos actuales o reemplazarlos. En el celular también se puede **compartir** el archivo, por ejemplo a Drive o WhatsApp.
- **Modo claro, oscuro o automático** y funcionamiento **sin conexión**.

## Diseño

Dirección visual «Cuaderno de huerta», definida a partir de una revisión hecha en Claude Design ([docs/claude-design](docs/claude-design/)).

- **Colores con significado:**
  - verde: crecer y acción principal;
  - azul agua: todo lo de riego;
  - terracota: tierra y almácigo;
  - ámbar: avisos.
- **Tipografía:**
  - **Bitter** para títulos;
  - **Atkinson Hyperlegible Next** para el texto, diseñada para distinguir letras parecidas con baja visión, útil a pleno sol.
  - Las dos están dentro del proyecto, así que funcionan sin conexión.
- **Íconos de especies:** SVG propios, con contorno y manchas de color plano. Se ven igual en todos los teléfonos y el contorno se adapta al tema claro u oscuro.
- **Animaciones sutiles:** al regar, al anotar una cosecha y al entrar a una pantalla. Se desactivan si el sistema pide menos movimiento.

## Estructura

```
cultivadorapp/
├── index.html            # Estructura, navegación inferior, íconos SVG y diálogos
├── styles.css            # Estilos mobile-first, temas claro/oscuro
├── app.js                # Rutas (#/…), estado, vistas, formularios y respaldo
├── data/cultivos.json    # Fichas de las especies
├── manifest.webmanifest  # Datos de la PWA
├── sw.js                 # Service worker (uso sin conexión)
├── fonts/                # Bitter y Atkinson Hyperlegible Next (woff2) y sus licencias OFL
├── icons/                # Íconos de la app
└── docs/claude-design/   # Prompt, capturas y revisión estética usada para el rediseño
```

### Datos en `localStorage`

Todo se guarda bajo la clave `cultivador:v1`:

```json
{
  "version": 1,
  "cultivos": [{ "id": "…", "especieId": "poroto-mata-baja", "apodo": "Bancal norte",
                 "fechaSiembra": "2026-10-06", "metodo": "directa", "fechaTrasplante": null,
                 "ubicacion": "bancal", "notas": "", "archivado": false, "creado": "…", "actualizado": "…" }],
  "bitacora": [{ "id": "…", "cultivoId": "…", "fecha": "2026-10-06", "tipo": "cosecha",
                 "texto": "", "cantidad": 250, "unidad": "g", "creado": "…" }],
  "preferencias": { "tema": "auto", "ultimoRespaldo": "2026-10-06" }
}
```

La etapa de cada cultivo no se guarda: se calcula con la fecha de siembra y los días de la ficha.
En los cultivos de almácigo, un trasplante tardío (o todavía pendiente) corre las etapas siguientes.

## Probar en local

La app carga `data/cultivos.json` con `fetch`, así que **hay que abrirla desde un servidor**. Si abres `index.html` con doble clic, no funciona.

Con Python, que ya viene en macOS y Linux:

```bash
python -m http.server 8000
```

O con Node.js:

```bash
npx serve .
```

Después abre <http://localhost:8000>.

**Para probarla en tu celular dentro de la misma red Wi-Fi:**

1. Inicia el servidor con `python -m http.server 8000 --bind 0.0.0.0`.
2. Abre `http://IP-DE-TU-PC:8000` en el celular.

En esa dirección (http y sin "localhost") el navegador no activa el modo sin conexión. Todo lo demás funciona.

> **Ojo al editar el código:** el service worker guarda los archivos en caché. Después de un cambio, recarga dos veces o activa *Update on reload* en DevTools → Application → Service workers.
> Al publicar cambios, sube el número de `VERSION` en `sw.js` para que los teléfonos descarten la caché anterior.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub, por ejemplo `cultivador`.
2. Sube los archivos desde esta carpeta:

   ```bash
   git init
   git add .
   git commit -m "Primera versión de Cultivador"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/cultivador.git
   git push -u origin main
   ```
3. En GitHub entra a **Settings → Pages**.
4. En **Build and deployment** elige **Source: Deploy from a branch**, luego la rama **main** y la carpeta **/ (root)**. Guarda.
5. En uno o dos minutos la app queda en `https://TU-USUARIO.github.io/cultivador/`.

Todas las rutas del proyecto son relativas, así que funciona dentro de la subcarpeta del repositorio sin cambiar nada.

## Instalar en el celular

- **Android (Chrome):** abre la dirección, toca el menú ⋮ y luego **Instalar app** (o *Agregar a la pantalla principal*).
- **iPhone (Safari):** toca **Compartir** y luego **Agregar a inicio**.

## Respaldo: importante

`localStorage` vive solo en ese navegador y ese dispositivo. Se borra si limpias los datos de navegación.
En iPhone, Safari puede borrarlo si no abres la app durante varias semanas, salvo que esté instalada en la pantalla de inicio.

Por eso conviene:

- instalar la app en el teléfono;
- descargar un respaldo en **Ajustes → Respaldo de datos** de vez en cuando y guardarlo en el correo o en la nube. El inicio te avisa cuando pasan más de 30 días sin respaldo.

## Agregar especies

Agrega un objeto al arreglo `especies` de `data/cultivos.json`. Copia una ficha existente y ajusta estos campos:

| Campo | Descripción |
|---|---|
| `id` | Identificador único en minúsculas, por ejemplo `"arveja"`. |
| `siembra.mesesDirecta` / `mesesAlmacigo` / `mesesTrasplante` | Meses del 1 al 12 (en orden de temporada, por ejemplo `[10, 11, 12, 1]`). |
| `siembra.metodos`, `metodoRecomendado` | `"directa"` y/o `"almacigo"`. |
| `diasGerminacion`, `diasCosecha` | Rangos `[mín, máx]` contados desde la siembra. |
| `diasAlmacigo` | Rango de días en almácigo, o `null`. |
| `diasFloracion` | Días hasta la floración, o `null` si se cosecha la hoja (lechuga, cilantro). |
| `ventanaCosechaDias` | Cuántos días dura la temporada de cosecha. |
| `riego.diasAlerta` | Días sin riego a partir de los cuales el inicio avisa. |
| `companeras`, `incompatibles` | Nombres libres. Si usas el `id` de otra especie, se convierte en enlace a su ficha. |

Después sube el número de `VERSION` en `sw.js`.

## Accesibilidad

- Pensada para cumplir WCAG 2.1 nivel AA.
- HTML semántico: navegación con `aria-current`, títulos ordenados, `<dialog>` nativo con foco atrapado y Esc para cerrar, y etiquetas en todos los campos.
- Al validar un formulario, los errores se anuncian y el foco va al campo con problemas.
- Contraste de texto de al menos 4,5:1 en ambos temas, verificado par por par. Texto base de 17 px y zonas táctiles de al menos 44 px.
- Los avisos se anuncian a los lectores de pantalla (`aria-live`).
- Los botones repetidos incluyen el nombre del cultivo, por ejemplo «Regué hoy (Tomate)».
- Respeta `prefers-reduced-motion` y `prefers-contrast: more`.
- Los estados nunca dependen solo del color:
  - etapas con ✓ y ●;
  - plantas vecinas con ✓ y ✕;
  - calendario con relleno, puntos o rayas;
  - avisos de riego con ícono y texto.

## Créditos

- Fuentes [Bitter](https://fonts.google.com/specimen/Bitter) y [Atkinson Hyperlegible Next](https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next), bajo la licencia SIL Open Font License 1.1. Las licencias están en `fonts/`.
