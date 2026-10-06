# Prompt para Claude Design: revisión estética de Cultivador

**Adjunta junto con el prompt:**

1. Las capturas de `docs/claude-design/capturas/`. Todas son a 390 px de ancho, en tema claro y oscuro:
   - `01` a `06`: pantallas completas.
   - `07`: diálogo de nueva entrada.
   - `08`: primera vista del inicio, tal como se ve al abrir la app.
   - `09`: estado vacío.
2. Los archivos `styles.css` e `index.html`. Opcionalmente `app.js`, para ver cómo se arma cada vista.

Copia desde la línea siguiente hasta el final.

---

## Rol

Actúa como diseñador/a visual senior de producto, con experiencia en apps móviles de uso cotidiano, sistemas de diseño y accesibilidad (WCAG 2.1 AA). Te pido una **revisión estética y visual**, no funcional.

## La app

**Cultivador** es una web app (PWA) para llevar una huerta en el patio de una casa en Penco, Chile.

- **Uso principal:** en el celular, de pie en el patio, muchas veces a pleno sol y con las manos sucias. Una persona abre la app, revisa qué toca regar, toca «Regué hoy» y anota lo que ve.
- **Pantallas:**
  - **Inicio:** resumen del día, riego por cultivo, próximas cosechas y qué sembrar este mes.
  - **Guía:** fichas de 8 especies, con calendario de siembra, datos de siembra, plantas compañeras, plagas y señales de cosecha.
  - **Mis cultivos:** tarjetas con la etapa estimada, barra de progreso y pasos (Germina → Almácigo → Crece → Florece → Cosecha).
  - **Bitácora:** entradas por fecha, con filtros.
  - **Ajustes:** tema y respaldo de datos.
- **Navegación:** barra inferior con 4 pestañas. Ajustes está en un ícono de la cabecera.
- **Idioma:** español de Chile («porotos», «choclo», «zapallo italiano»).

## Sistema visual actual (está en `styles.css`)

- **Colores, tema claro:**
  - fondo crema `#f5f1e6` y tarjetas blancas;
  - texto `#1c2619` y texto secundario `#4a5245`;
  - verde principal `#2f6b2f` y verde suave `#dcebd3`;
  - tierra `#8a4a1f` (íconos de sección y almácigo);
  - aviso amarillo `#fff0c2`, con texto `#5a3b00`.
- **Colores, tema oscuro:** fondo `#111811`, tarjetas `#1a241a` y verde `#8fd18a`.
- **Tipografía:** fuente del sistema (`system-ui`), base de 17 px. Títulos de 1,25 a 1,6 rem en negrita.
- **Componentes:**
  - tarjetas con radio de 14 px y sombra suave;
  - botones tipo píldora de 48 px de alto;
  - opciones segmentadas con ✓;
  - insignias;
  - chips de especies;
  - diálogos tipo *bottom sheet* en celular;
  - avisos flotantes (toast).
- **Íconos:** SVG de trazo propios para la interfaz y **emojis** para las especies (🫘 🫛 🍅 🥬 🥒 🌽 🌿 🪴).

## Qué quiero que evalúes

Revisa cada captura y dime qué funciona y qué no en:

1. **Primera impresión e identidad.** ¿Transmite «huerta, tierra, plantas» y se siente cálida y confiable, o se ve genérica? ¿Qué le daría personalidad propia?
2. **Jerarquía visual.**
   - En Inicio, ¿se entiende en 3 segundos qué hay que hacer hoy?
   - ¿Compiten entre sí el aviso de respaldo, los 3 indicadores y la lista de riego?
   - ¿Los botones «Regué hoy» repetidos ocupan demasiado?
3. **Tarjetas de cultivo.**
   - Densidad de información: etapa, barra, pasos, descripción, datos, botones y el botón «Más» que queda solo en una línea.
   - ¿Cómo se podría ver el avance del cultivo de forma más atractiva y fácil de leer de un vistazo?
4. **Consistencia.** Radios, sombras, bordes, grosores, separaciones y estilos de botón (primario, secundario, suave, texto) entre pantallas.
5. **Color.**
   - ¿La paleta verde y tierra está bien usada?
   - ¿Hay demasiado verde suave?
   - ¿El tema oscuro está a la altura del claro?
   - ¿El amarillo de alerta se integra bien?
6. **Tipografía.** Escala, pesos y largo de línea. ¿Conviene una fuente con más carácter? Si la propones, debe poder alojarse dentro del proyecto, porque la app funciona sin conexión.
7. **Iconografía e ilustración.**
   - ¿Los emojis de especies se ven bien al lado de los íconos SVG de trazo, o conviene un set ilustrado propio?
   - Propón un estilo coherente para las 8 especies y los estados vacíos.
8. **Guía y ficha de especie.** Calendario de 12 meses, cuadrícula de datos, listas de plantas compañeras y plagas: ¿cómo hacerlas más escaneables y atractivas?
9. **Detalles y microinteracciones.** Animaciones o respuestas visuales al tocar «Regué hoy», al completar una etapa o al cosechar. Deben ser sutiles y desactivarse con `prefers-reduced-motion`.

## Restricciones (no negociables)

- **Accesibilidad AA:**
  - texto con contraste de al menos 4,5:1, y de 3:1 para bordes, íconos y foco;
  - zonas táctiles de al menos 44 × 44 px;
  - foco visible;
  - nada que se entienda solo por color.
- **Legible a pleno sol:** nada de grises claros sobre fondos claros ni textos finos.
- **Mobile-first:** de 360 a 430 px, y que escale bien a tablet y escritorio.
- **Implementable con HTML, CSS y JavaScript vanilla.** Sin frameworks ni librerías de componentes. Íconos e ilustraciones en SVG en línea.
- **Funciona sin conexión:** nada que dependa de recursos externos en tiempo de ejecución.
- **No cambies** la funcionalidad, la arquitectura de navegación (4 pestañas abajo) ni los textos en español de Chile, salvo que sea una mejora clara de microcopy y lo justifiques.
- **Tema claro y oscuro:** se mantienen ambos.

## Entregables

1. **Diagnóstico** (máximo 1 página):
   - 3 a 5 fortalezas que hay que conservar;
   - una lista de problemas visuales, cada uno con pantalla, severidad (alta, media o baja) y por qué afecta a la persona usuaria.
2. **Dos direcciones visuales**, en un párrafo cada una, con su paleta y tipografía. Por ejemplo, una «cuaderno de campo» más cálida e ilustrada y otra «moderna y limpia» más sobria. Recomienda una y explica por qué.
3. **Mockups de la dirección recomendada** a 390 px, en tema claro y oscuro, de:
   - Inicio;
   - Mis cultivos (una tarjeta en germinación, una en floración y una en cosecha);
   - Ficha de especie;
   - Bitácora;
   - el diálogo «Nueva entrada».
4. **Tokens de diseño listos para pegar** en `:root` y en el bloque del tema oscuro de `styles.css`: colores, radios, sombras, espaciados y escala tipográfica. Incluye una tabla con el contraste de cada par de texto y fondo.
5. **Plan de cambios priorizado** en una tabla con estas columnas: cambio · impacto (alto, medio o bajo) · esfuerzo (S, M o L) · selectores o componentes CSS afectados. Empieza por las mejoras rápidas de alto impacto.

Si algo de las capturas es ambiguo, como un estado que no aparece, dilo y asume lo más razonable para una persona que cultiva en casa.
