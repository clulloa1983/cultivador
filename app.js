/* =========================================================
   Cultivador — guía de cultivo y bitácora de huerta
   SPA en JavaScript vanilla. Datos en localStorage.
   ========================================================= */

// ---------- Constantes ----------
const CLAVE = 'cultivador:v1';
const VERSION_DATOS = 1;
const DIA_MS = 86400000;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_INICIAL = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const TIPOS = {
  riego: { nombre: 'Riego', svg: 'gota' },
  abono: { nombre: 'Abono', svg: 'abono' },
  observacion: { nombre: 'Observación', svg: 'ojo' },
  plaga: { nombre: 'Plaga', svg: 'bicho' },
  cosecha: { nombre: 'Cosecha', svg: 'cosecha' },
};
const UBICACIONES = { macetero: 'Macetero', bancal: 'Bancal', suelo: 'Suelo' };
const METODOS = { directa: 'Siembra directa', almacigo: 'Almácigo', plantin: 'Plantín comprado' };
const UNIDADES = { g: 'g', kg: 'kg', unidades: 'unidades', atados: 'atados' };
const TEMAS = ['auto', 'claro', 'oscuro'];
const ESPECIE_DESCONOCIDA = {
  nombre: 'Especie desconocida', nombreCorto: 'Especie desconocida', icono: '🌱',
  diasGerminacion: [7, 14], diasAlmacigo: null, diasFloracion: null, diasCosecha: [60, 90],
  ventanaCosechaDias: 30, riego: { diasAlerta: 3 }, siembra: { metodos: ['directa'], metodoRecomendado: 'directa' },
};

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const tiene = (obj, clave) => Object.hasOwn(obj, clave);
const vista = $('#vista');

let especies = [];
const especiesPorId = new Map();
let estado = cargar();
let rutaAnterior = null;
let focoPendiente = null;
let diaRenderizado = null;
let recienRegados = new Set(); // para animar el ✓ recién aparecido
let recienAnotada = null;      // para destacar la entrada recién guardada

// ---------- Utilidades ----------
function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function aISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function hoyISO() { return aISO(new Date()); }
function aFecha(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}
function esFechaISO(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && aISO(aFecha(s)) === s;
}
function diasEntre(desde, hasta) { return Math.round((aFecha(hasta) - aFecha(desde)) / DIA_MS); }
function sumarDias(iso, n) {
  const d = aFecha(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
}
const fmtDia = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long' });
const fmtDiaAnio = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDiaCorto = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' });
const fmtSemana = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
function mismoAnio(iso) { return aFecha(iso).getFullYear() === new Date().getFullYear(); }
function fmtFecha(iso) { return (mismoAnio(iso) ? fmtDia : fmtDiaAnio).format(aFecha(iso)); }
function fmtFechaCorta(iso) { return fmtDiaCorto.format(aFecha(iso)).replace('.', ''); }
function fmtRelativo(iso, hoy = hoyISO()) {
  const n = diasEntre(iso, hoy);
  if (n === 0) return 'hoy';
  if (n === 1) return 'ayer';
  if (n === -1) return 'mañana';
  return n > 0 ? `hace ${n} días` : `en ${-n} días`;
}
function plural(n, uno, varios) { return `${n} ${n === 1 ? uno : varios}`; }
function num(n) { return Number(n).toLocaleString('es-CL'); }
/** Lee números escritos al estilo chileno: "1,5" → 1.5 y "1.500" → 1500. Devuelve NaN si no es válido. */
function leerNumero(txt) {
  let t = String(txt).trim().replace(/\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}
function rango([min, max], unidad) {
  return min === max ? `${num(min)} ${unidad}` : `${num(min)} a ${num(max)} ${unidad}`;
}
function capitalizar(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function listaTexto(items) {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}
function uid() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* contexto no seguro */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function icono(nombre) {
  return `<svg aria-hidden="true" focusable="false"><use href="#i-${nombre}"/></svg>`;
}
/** Ícono de una especie (decorativo). `clase`: '' (cuadro de 40 px), 'grande' o 'chico' (en línea). */
function glifo(e, clase = '') {
  const contenido = e.id && document.getElementById(`g-${e.id}`)
    ? `<svg focusable="false"><use href="#g-${esc(e.id)}"/></svg>`
    : esc(e.icono);
  return `<span class="glifo ${clase}" aria-hidden="true">${contenido}</span>`;
}

/** Ilustración de los estados vacíos: tres plantas sobre una línea de tierra. */
function ilustracionVacia() {
  return `<div class="huerta-vacia" aria-hidden="true"><div>`
    + '<svg class="g-chica"><use href="#g-lechuga"/></svg><svg><use href="#g-tomate"/></svg><svg class="g-chica"><use href="#g-poroto-enredadera"/></svg>'
    + '</div><i></i></div>';
}

/** ¿La persona pidió menos movimiento? */
function menosMovimiento() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function estacion(mes) {
  return ['verano', 'verano', 'otoño', 'otoño', 'otoño', 'invierno', 'invierno', 'invierno', 'primavera', 'primavera', 'primavera', 'verano'][mes - 1];
}
/** Convierte [10,11,12,1] en "octubre a enero" (los rangos pueden cruzar el año). */
function textoMeses(meses) {
  if (!meses?.length) return '';
  const set = new Set(meses);
  if (set.size === 12) return 'todo el año';
  const sig = (m) => (m === 12 ? 1 : m + 1);
  const tramos = [];
  for (const m of meses) {
    if (set.has(m === 1 ? 12 : m - 1)) continue;
    let fin = m;
    while (set.has(sig(fin))) fin = sig(fin);
    tramos.push(m === fin ? MESES[m - 1] : `${MESES[m - 1]} a ${MESES[fin - 1]}`);
  }
  return listaTexto(tramos);
}

// ---------- Almacenamiento ----------
function estadoVacio() {
  return { version: VERSION_DATOS, cultivos: [], bitacora: [], preferencias: { tema: 'auto', ultimoRespaldo: null } };
}

function cargar() {
  let crudo = null;
  try {
    crudo = localStorage.getItem(CLAVE);
    if (!crudo) return estadoVacio();
    return normalizar(JSON.parse(crudo)).datos;
  } catch (err) {
    console.error('Datos guardados ilegibles', err);
    // Conserva una copia para no perder información si algo se corrompió.
    try { if (crudo) localStorage.setItem(`${CLAVE}:corrupto`, crudo); } catch { /* sin espacio */ }
    return estadoVacio();
  }
}

let persistenciaPedida = false;
function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch (err) {
    console.error(err);
    toast('No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.');
    return false;
  }
  // Pide al navegador que no borre estos datos automáticamente.
  if (!persistenciaPedida && navigator.storage?.persist) {
    persistenciaPedida = true;
    navigator.storage.persist().catch(() => {});
  }
  return true;
}

/**
 * Valida y limpia datos (de localStorage o de un respaldo importado).
 * Lanza un Error con mensaje para el usuario si el formato no sirve.
 */
function normalizar(obj) {
  const formatoInvalido = 'El archivo no tiene el formato de respaldo de Cultivador.';
  if (!obj || typeof obj !== 'object') throw new Error(formatoInvalido);
  const fuente = obj.datos && typeof obj.datos === 'object' ? obj.datos : obj;
  if (!Array.isArray(fuente.cultivos) || !Array.isArray(fuente.bitacora)) throw new Error(formatoInvalido);
  const version = obj.version ?? fuente.version;
  if (typeof version === 'number' && version > VERSION_DATOS) {
    throw new Error('El respaldo viene de una versión más nueva de Cultivador. Actualiza la app y vuelve a intentarlo.');
  }

  const ahora = new Date().toISOString();
  const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const idValido = (v) => typeof v === 'string' && v.length > 0 && v.length <= 100;
  let descartados = 0;

  const cultivos = [];
  const idsCultivos = new Set();
  for (const c of fuente.cultivos) {
    if (!c || !idValido(c.id) || idsCultivos.has(c.id) || !idValido(c.especieId) || !esFechaISO(c.fechaSiembra)) {
      descartados++;
      continue;
    }
    idsCultivos.add(c.id);
    let metodo = c.metodo === 'almacigo' || c.metodo === 'plantin' ? c.metodo : 'directa';
    if (metodo === 'plantin' && !esFechaISO(c.fechaTrasplante)) metodo = 'almacigo';
    cultivos.push({
      id: c.id,
      especieId: c.especieId,
      apodo: texto(c.apodo, 40),
      fechaSiembra: c.fechaSiembra,
      metodo,
      fechaTrasplante: metodo !== 'directa' && esFechaISO(c.fechaTrasplante) ? c.fechaTrasplante : null,
      ubicacion: typeof c.ubicacion === 'string' && tiene(UBICACIONES, c.ubicacion) ? c.ubicacion : 'bancal',
      notas: texto(c.notas, 1000),
      archivado: c.archivado === true,
      creado: texto(c.creado, 40) || ahora,
      actualizado: texto(c.actualizado, 40) || ahora,
    });
  }

  const bitacora = [];
  const idsEntradas = new Set();
  for (const e of fuente.bitacora) {
    if (!e || !idValido(e.id) || idsEntradas.has(e.id) || !idsCultivos.has(e.cultivoId)
      || !esFechaISO(e.fecha) || typeof e.tipo !== 'string' || !tiene(TIPOS, e.tipo)) {
      descartados++;
      continue;
    }
    idsEntradas.add(e.id);
    const cantidad = e.cantidad === null || e.cantidad === '' || e.cantidad === undefined ? NaN : Number(e.cantidad);
    bitacora.push({
      id: e.id,
      cultivoId: e.cultivoId,
      fecha: e.fecha,
      tipo: e.tipo,
      texto: texto(e.texto, 2000),
      cantidad: e.tipo === 'cosecha' && Number.isFinite(cantidad) && cantidad >= 0 ? cantidad : null,
      unidad: typeof e.unidad === 'string' && tiene(UNIDADES, e.unidad) ? e.unidad : 'g',
      creado: texto(e.creado, 40) || ahora,
    });
  }

  const p = fuente.preferencias && typeof fuente.preferencias === 'object' ? fuente.preferencias : {};
  const preferencias = {
    tema: TEMAS.includes(p.tema) ? p.tema : 'auto',
    ultimoRespaldo: esFechaISO(p.ultimoRespaldo) ? p.ultimoRespaldo : null,
  };
  return { datos: { version: VERSION_DATOS, cultivos, bitacora, preferencias }, descartados };
}

// ---------- Dominio ----------
function especieDe(c) {
  return especiesPorId.get(c.especieId) || { ...ESPECIE_DESCONOCIDA, id: c.especieId };
}
function buscarCultivo(id) { return estado.cultivos.find((c) => c.id === id); }
function buscarEntrada(id) { return estado.bitacora.find((e) => e.id === id); }
function nombreCultivo(c) {
  const e = especieDe(c);
  return c.apodo ? `${e.nombreCorto} · ${c.apodo}` : e.nombreCorto;
}
/** Texto del método según la especie (el ajo no se «siembra»: se plantan dientes). */
function textoMetodo(metodo, e) {
  return e.metodoTexto?.[metodo] || METODOS[metodo];
}
/** «Siembra directa» o «Plantación» (ajo), para calendarios e insignias. */
function nombreDirecta(e) {
  return e.metodoTexto?.directa ? 'Plantación' : 'Siembra directa';
}
/** Nombre de una etapa con las etiquetas propias de la especie (p. ej. «Brota», «Bulbo»). */
function etiquetaEtapa(e, id, nombre, corto) {
  const x = e.etiquetas?.[id];
  return [x?.nombre || nombre, x?.corto || corto];
}
/** Días que un plantín pasa en almácigo (punto medio del rango de la especie). */
function diasAlmacigoEstimados(e) {
  const [min, max] = e.diasAlmacigo || [20, 30];
  return Math.round((min + max) / 2);
}
function cultivosActivos() { return estado.cultivos.filter((c) => !c.archivado); }
function ultimoRiego(cultivoId) {
  let max = null;
  for (const e of estado.bitacora) {
    if (e.cultivoId === cultivoId && e.tipo === 'riego' && (!max || e.fecha > max)) max = e.fecha;
  }
  return max;
}
function regadoHoy(cultivoId) {
  const u = ultimoRiego(cultivoId);
  return Boolean(u && u >= hoyISO());
}
function temporadaEnMes(e, mes) {
  const s = e.siembra;
  return {
    directa: s.mesesDirecta.includes(mes),
    almacigo: s.mesesAlmacigo.includes(mes),
    trasplante: s.mesesTrasplante.includes(mes),
  };
}
function esDelMes(e, mes) {
  const t = temporadaEnMes(e, mes);
  return t.directa || t.almacigo || t.trasplante;
}

/**
 * Estima la etapa de un cultivo según los días transcurridos desde la siembra.
 * Con almácigo, un trasplante tardío (o aún pendiente) retrasa las etapas siguientes.
 */
function calcularEtapas(c, e = especieDe(c), hoy = hoyISO()) {
  const dia = diasEntre(c.fechaSiembra, hoy);
  const germ = e.diasGerminacion[1];
  // Un plantín comprado se trata como almácigo ya trasplantado; la fecha de siembra se estimó al guardarlo.
  const almacigo = c.metodo === 'almacigo' || c.metodo === 'plantin';
  const inicioConteo = c.metodo === 'plantin' && c.fechaTrasplante ? diasEntre(c.fechaSiembra, c.fechaTrasplante) : 0;
  let desfase = 0;
  let finAlmacigo = null;
  let trasplanteEstimado = null;
  let listoTrasplantar = false;

  if (almacigo) {
    const [amin] = e.diasAlmacigo || [20, 30];
    const est = diasAlmacigoEstimados(e);
    trasplanteEstimado = sumarDias(c.fechaSiembra, est);
    if (c.fechaTrasplante) {
      const real = Math.max(germ + 1, diasEntre(c.fechaSiembra, c.fechaTrasplante));
      desfase = Math.max(0, real - est);
      finAlmacigo = real;
    } else {
      if (dia >= amin) listoTrasplantar = true;
      if (dia > est) desfase = dia - est; // sigue en almácigo: todo se corre
      finAlmacigo = est + desfase;
    }
  }

  const etapas = [];
  let inicio = 0;
  const agregar = (id, nombre, corto, fin) => {
    const f = Math.max(fin, inicio + 1);
    etapas.push({ id, nombre, corto, inicio, fin: f });
    inicio = f;
  };
  const inicioCosecha = e.diasCosecha[0] + desfase;
  agregar('germinacion', ...etiquetaEtapa(e, 'germinacion', 'Germinación', 'Germina'), germ);
  if (almacigo) agregar('almacigo', 'Almácigo', 'Almácigo', finAlmacigo);
  if (e.diasFloracion) {
    agregar('crecimiento', 'Crecimiento', 'Crece', e.diasFloracion + desfase);
    agregar('floracion', ...etiquetaEtapa(e, 'floracion', 'Floración', 'Florece'), inicioCosecha);
  } else {
    agregar('crecimiento', 'Crecimiento', 'Crece', inicioCosecha);
  }
  agregar('cosecha', 'Cosecha', 'Cosecha', inicioCosecha + e.ventanaCosechaDias);
  const total = inicio;
  const cosecha = etapas.at(-1);
  const floracion = etapas.find((x) => x.id === 'floracion');

  let estadoCiclo = 'activo';
  let actual = etapas.findIndex((x) => dia >= x.inicio && dia < x.fin);
  if (dia < 0 || dia < inicioConteo) { estadoCiclo = 'programado'; actual = -1; }
  else if (dia >= total) { estadoCiclo = 'terminado'; actual = etapas.length; }

  return {
    dia, total, etapas, actual, estado: estadoCiclo, inicioConteo,
    plantin: c.metodo === 'plantin',
    etapa: etapas[actual] || null,
    progreso: Math.min(Math.max(dia, 0), total),
    listoTrasplantar: listoTrasplantar && etapas[actual]?.id === 'almacigo',
    trasplanteEstimado,
    fechaFloracion: floracion ? sumarDias(c.fechaSiembra, floracion.inicio) : null,
    fechaCosechaInicio: sumarDias(c.fechaSiembra, cosecha.inicio),
    fechaCosechaFin: sumarDias(c.fechaSiembra, cosecha.fin),
    diasParaCosecha: cosecha.inicio - dia,
  };
}

function nombreEtapa(info, e) {
  if (info.estado === 'programado') return info.plantin ? 'Por trasplantar' : e.metodoTexto?.directa ? 'Por plantar' : 'Por sembrar';
  if (info.estado === 'terminado') return 'Ciclo terminado';
  if (info.listoTrasplantar) return 'Lista para trasplantar';
  return info.etapa.nombre;
}

function descripcionEtapa(c, e, info) {
  if (info.estado === 'programado') {
    if (info.plantin) return `Trasplante programado para el ${fmtFecha(c.fechaTrasplante)}.`;
    return `${e.metodoTexto?.directa ? 'Plantación programada' : 'Siembra programada'} para el ${fmtFecha(c.fechaSiembra)}.`;
  }
  if (info.estado === 'terminado') return `El ciclo estimado terminó el ${fmtFecha(info.fechaCosechaFin)}. Si ya no produce, puedes archivarlo.`;
  const desdeCosecha = `Cosecha estimada desde el ${fmtFecha(info.fechaCosechaInicio)}.`;
  switch (info.etapa.id) {
    case 'germinacion':
      return `Mantén la tierra húmeda. Debería ${e.etiquetas?.germinacion?.verbo || 'germinar'} entre los días ${e.diasGerminacion[0]} y ${e.diasGerminacion[1]}.`;
    case 'almacigo':
      return info.listoTrasplantar
        ? '¡Ya puedes trasplantar! Hazlo en una tarde nublada y luego anota la fecha con «Editar».'
        : `Plantines en almácigo. Trasplante estimado cerca del ${fmtFecha(info.trasplanteEstimado)}.`;
    case 'crecimiento':
      return info.fechaFloracion
        ? `La planta desarrolla hojas y raíces. ${etiquetaEtapa(e, 'floracion', 'Floración')[0]} estimada cerca del ${fmtFecha(info.fechaFloracion)}.`
        : `La planta desarrolla hojas y raíces. ${desdeCosecha}`;
    case 'floracion':
      return `${e.etiquetas?.floracion?.texto || '¡Aparecen las flores! No dejes que le falte agua.'} ${desdeCosecha}`;
    case 'cosecha':
      return `¡Época de cosecha hasta cerca del ${fmtFecha(info.fechaCosechaFin)}! Revisa las <a href="#/guia/${esc(e.id)}">señales de cosecha</a>.`;
    default:
      return '';
  }
}

// ---------- Enrutador ----------
function parsearHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [camino, consulta = ''] = h.split('?');
  const partes = camino.split('/').filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  return { ruta: partes[0] || 'inicio', param: partes[1] || null, query: new URLSearchParams(consulta) };
}

function claveRuta(r) { return `${r.ruta}/${r.param || ''}`; }

function actualizarQuery(clave, valor) {
  const r = parsearHash();
  if (valor) r.query.set(clave, valor); else r.query.delete(clave);
  const qs = r.query.toString();
  history.replaceState(null, '', `#/${r.ruta}${r.param ? `/${encodeURIComponent(r.param)}` : ''}${qs ? `?${qs}` : ''}`);
  render();
}

function render({ foco = null, navegacion = false } = {}) {
  if (!especies.length) return;
  diaRenderizado = hoyISO();
  const r = parsearHash();
  const fn = tiene(VISTAS, r.ruta) ? VISTAS[r.ruta] : vistaNoEncontrada;
  const { titulo, html } = fn(r);

  let claveFoco = foco;
  if (focoPendiente) { claveFoco = focoPendiente; focoPendiente = null; navegacion = false; }
  if (!claveFoco && !navegacion && vista.contains(document.activeElement)) {
    claveFoco = document.activeElement.dataset?.key || null;
  }

  vista.innerHTML = html;
  document.title = `${titulo} · Cultivador`;
  for (const a of $$('.nav-inferior a')) {
    if (a.dataset.ruta === r.ruta) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  const ajustes = $('#enlace-ajustes');
  if (r.ruta === 'ajustes') ajustes.setAttribute('aria-current', 'page');
  else ajustes.removeAttribute('aria-current');

  const h1 = $('h1', vista);
  h1?.setAttribute('tabindex', '-1');
  if (navegacion) {
    vista.classList.add('al-entrar');
    setTimeout(() => vista.classList.remove('al-entrar'), 1200);
    window.scrollTo(0, 0);
    h1?.focus({ preventScroll: true });
  } else if (claveFoco) {
    const el = $(`[data-key="${CSS.escape(claveFoco)}"]`, vista);
    if (el) {
      el.focus();
      if (foco) el.scrollIntoView({ block: 'nearest' });
    } else h1?.focus();
  }
}

// ---------- Vistas ----------
const VISTAS = {
  inicio: vistaInicio,
  guia: vistaGuia,
  cultivos: vistaCultivos,
  bitacora: vistaBitacora,
  ajustes: vistaAjustes,
};

function vistaNoEncontrada() {
  return {
    titulo: 'No encontrado',
    html: `<div class="vacio"><span class="glifo grande" aria-hidden="true"><svg><use href="#g-logo"/></svg></span>
      <h1>No encontramos esta página</h1>
      <p>Puede que el enlace esté incompleto.</p>
      <a class="boton primario" href="#/inicio">Ir al inicio</a></div>`,
  };
}

// ----- Guía -----
function insigniasMes(e, mes) {
  const t = temporadaEnMes(e, mes);
  const out = [];
  if (t.directa) out.push(`<span class="insignia verde"><i class="celda d" aria-hidden="true"></i>${nombreDirecta(e)} este mes</span>`);
  if (t.almacigo) out.push('<span class="insignia tierra"><i class="celda a" aria-hidden="true"></i>Almácigo este mes</span>');
  if (t.trasplante) out.push('<span class="insignia verde"><i class="celda t" aria-hidden="true"></i>Trasplante este mes</span>');
  if (!out.length) out.push('<span class="insignia">Fuera de temporada</span>');
  return `<div class="insignias">${out.join('')}</div>`;
}

function insigniaMesCompacta(e, mes) {
  const t = temporadaEnMes(e, mes);
  const directa = e.metodoTexto?.directa ? 'plantación' : t.almacigo || t.trasplante ? 'directa' : 'siembra directa';
  const que = [t.directa && directa, t.almacigo && 'almácigo', t.trasplante && 'trasplante'].filter(Boolean);
  return que.length
    ? `<div class="insignias"><span class="insignia verde">Este mes: ${listaTexto(que)}</span></div>`
    : '<div class="insignias"><span class="insignia">Fuera de temporada</span></div>';
}

function resumenSiembra(e) {
  const s = e.siembra;
  if (s.metodoRecomendado === 'almacigo' && s.mesesAlmacigo.length) {
    return `Almácigo: ${textoMeses(s.mesesAlmacigo)}. Trasplante: ${textoMeses(s.mesesTrasplante)}.`;
  }
  return `${e.metodoTexto?.directa ? 'Plantación' : 'Siembra'}: ${textoMeses(s.mesesDirecta)}.`;
}

/** Cuadrícula de especies que se pueden sembrar, almacigar o trasplantar este mes. */
function tarjetasDelMes(mes) {
  const items = especies.filter((e) => esDelMes(e, mes));
  if (!items.length) return '';
  return `<ul class="grilla-mes">${items.map((e) => {
    const t = temporadaEnMes(e, mes);
    const que = [t.directa && nombreDirecta(e).toLowerCase(), t.almacigo && 'almácigo', t.trasplante && 'trasplante'].filter(Boolean);
    return `<li><a class="tarjeta-mes" href="#/guia/${esc(e.id)}">${glifo(e)}`
      + `<span><strong>${esc(e.nombreCorto)}</strong><small>${capitalizar(listaTexto(que))}</small></span></a></li>`;
  }).join('')}</ul>`;
}

function vistaGuia(r) {
  if (r.param) return vistaFicha(r.param);
  const mes = new Date().getMonth() + 1;
  const filtro = r.query.get('filtro') === 'mes' ? 'mes' : 'todas';
  const delMes = especies.filter((e) => esDelMes(e, mes));
  const lista = filtro === 'mes' ? delMes : especies;

  const html = `
    <div class="encabezado-vista">
      <h1>Guía de cultivos</h1>
      <p>Calendario ajustado a Penco y la costa del Biobío.</p>
    </div>
    <section aria-labelledby="t-especies">
      <h2 id="t-especies" class="sr">Especies</h2>
      <fieldset class="campo filtros">
        <legend class="sr">Mostrar</legend>
        <div class="opciones-seg">
          <label><input type="radio" name="filtro-guia" value="todas" data-filtro="guia" data-key="filtro-guia-todas" ${filtro === 'todas' ? 'checked' : ''}><span>Todas (${especies.length})</span></label>
          <label><input type="radio" name="filtro-guia" value="mes" data-filtro="guia" data-key="filtro-guia-mes" ${filtro === 'mes' ? 'checked' : ''}><span>Para ${MESES[mes - 1]} (${delMes.length})</span></label>
        </div>
      </fieldset>
      <ul class="lista-tarjetas dos-col">
        ${lista.map((e) => `
          <li>
            <a class="tarjeta tarjeta-enlace" href="#/guia/${esc(e.id)}">
              ${glifo(e, 'medio')}
              <span>
                <h3>${esc(e.nombre)}</h3>
                <p>${esc(resumenSiembra(e))}</p>
                ${insigniaMesCompacta(e, mes)}
              </span>
            </a>
          </li>`).join('')}
      </ul>
    </section>`;
  return { titulo: 'Guía de cultivos', html };
}

/** Planta vecina: chip con ✓ o ✕ (además del color); las que tienen ficha llevan enlace y flecha. */
function chipVecina(nombre, buena) {
  const e = especiesPorId.get(nombre);
  const marca = `<span class="marca" aria-hidden="true">${icono(buena ? 'check' : 'cerrar')}</span>`;
  return e
    ? `<li><a class="vecina" href="#/guia/${esc(e.id)}">${marca}${esc(e.nombreCorto)}<span class="flecha" aria-hidden="true">${icono('volver')}</span></a></li>`
    : `<li><span class="vecina">${marca}${esc(nombre)}</span></li>`;
}

function vistaFicha(id) {
  const e = especiesPorId.get(id);
  if (!e) return vistaNoEncontrada();
  const mes = new Date().getMonth() + 1;
  const s = e.siembra;
  const filas = [
    ['d', nombreDirecta(e), s.mesesDirecta],
    ['a', 'Almácigo', s.mesesAlmacigo],
    ['t', 'Trasplante', s.mesesTrasplante],
  ].filter(([, , meses]) => meses.length);

  // Calendario visual (decorativo): la misma información va en texto justo debajo.
  const calendario = `
    <div class="tarjeta calendario-tarjeta">
      <div class="cal" aria-hidden="true">
        <span class="cal-rotulo">Mes</span>
        ${MESES_INICIAL.map((ini, i) => `<span class="cal-mes ${i + 1 === mes ? 'hoy' : ''}">${ini}</span>`).join('')}
        ${filas.map(([cl, nombre, meses]) => `
          <span class="cal-rotulo">${nombre}</span>
          ${MESES_INICIAL.map((_, i) => `<span class="celda ${meses.includes(i + 1) ? cl : ''} ${i + 1 === mes ? 'hoy' : ''}"></span>`).join('')}`).join('')}
      </div>
      <ul class="leyenda" aria-hidden="true">
        ${filas.map(([cl, nombre]) => `<li><i class="celda ${cl}"></i>${nombre}</li>`).join('')}
        <li><i class="muestra-hoy"></i>Hoy (${MESES[mes - 1]})</li>
      </ul>
    </div>
    <ul class="cal-texto">
      ${filas.map(([, nombre, meses]) => `<li><strong>${nombre}:</strong> ${textoMeses(meses)}.</li>`).join('')}
    </ul>
    <p class="texto-suave">${esc(s.notas)}</p>
    ${e.aviso ? `<div class="aviso neutro">${icono('alerta')}<p>${esc(e.aviso)}</p></div>` : ''}`;

  const datos = [
    ['Profundidad', rango(e.profundidadCm, 'cm')],
    ['Entre plantas', rango(e.distanciaCm.plantas, 'cm')],
    ['Entre hileras', rango(e.distanciaCm.hileras, 'cm')],
    [etiquetaEtapa(e, 'germinacion', 'Germinación')[0], rango(e.diasGerminacion, 'días')],
  ];
  if (e.diasAlmacigo) datos.push(['En almácigo', rango(e.diasAlmacigo, 'días')]);
  if (e.diasFloracion) datos.push([etiquetaEtapa(e, 'floracion', 'Floración')[0], `~${e.diasFloracion} días`]);
  datos.push(['Cosecha desde', rango(e.diasCosecha, 'días')]);
  datos.push(['Temporada de cosecha', `~${plural(Math.round(e.ventanaCosechaDias / 7), 'semana', 'semanas')}`]);

  const html = `
    <a class="volver" href="#/guia">${icono('volver')}Guía</a>
    <div class="ficha-cabecera">
      ${glifo(e, 'grande')}
      <div>
        <h1>${esc(e.nombre)}</h1>
        <p lang="la">${esc(e.nombreCientifico)}</p>
      </div>
    </div>
    <p>${esc(e.descripcion)}</p>
    ${insigniasMes(e, mes)}
    <p style="margin-top:16px">
      <button type="button" class="boton primario ancho" data-accion="nuevo-cultivo" data-especie="${esc(e.id)}" data-key="sembrar-${esc(e.id)}">
        ${icono('mas')}Registrar una siembra
      </button>
    </p>

    <section class="seccion" aria-labelledby="t-cuando">
      <h2 id="t-cuando">${icono('calendario')}Cuándo sembrar</h2>
      ${calendario}
    </section>

    <section class="seccion" aria-labelledby="t-como">
      <h2 id="t-como">${icono('cultivos')}Cómo sembrar</h2>
      <div class="tarjeta tabla-datos">
        <dl class="datos-tabla">
          ${datos.map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${esc(dd)}</dd></div>`).join('')}
        </dl>
        <div class="dato-destacado">
          <span class="ico-cuadro sol" aria-hidden="true">${icono('sol')}</span>
          <p><strong>Sol</strong>${esc(e.sol.texto)}</p>
        </div>
        <div class="dato-destacado">
          <span class="ico-cuadro agua" aria-hidden="true">${icono('gota')}</span>
          <p><strong>Riego · ${esc(e.riego.frecuencia)}</strong>${esc(e.riego.texto)}</p>
        </div>
      </div>
      <p class="texto-suave chico">Los días se cuentan desde la siembra de la semilla.</p>
    </section>

    <section class="seccion" aria-labelledby="t-vecinos">
      <h2 id="t-vecinos">${icono('inicio')}Buenas y malas vecinas</h2>
      <h3>Plantas compañeras</h3>
      <ul class="vecinas buena">${e.companeras.map((p) => chipVecina(p, true)).join('')}</ul>
      <h3>No plantar cerca de</h3>
      <ul class="vecinas mala">${e.incompatibles.map((p) => chipVecina(p, false)).join('')}</ul>
    </section>

    <section class="seccion" aria-labelledby="t-plagas">
      <h2 id="t-plagas">${icono('bicho')}Plagas y problemas comunes</h2>
      <p class="texto-suave chico">Toca una para ver cómo reconocerla y qué hacer.</p>
      <div class="tarjeta lista-plagas">
        ${e.plagas.map((p, i) => `
          <details class="plaga" name="plagas-${esc(e.id)}" ${i === 0 ? 'open' : ''}>
            <summary>${esc(p.nombre)}${icono('volver')}</summary>
            <div class="plaga-cuerpo">
              <p>${icono('ojo')}<span><strong>Cómo se ve</strong>${esc(p.senal)}</span></p>
              <p class="hacer">${icono('check')}<span><strong>Qué hacer</strong>${esc(p.manejo)}</span></p>
            </div>
          </details>`).join('')}
      </div>
    </section>

    <section class="seccion" aria-labelledby="t-cosecha">
      <h2 id="t-cosecha">${icono('cosecha')}¿Está lista para cosechar?</h2>
      <ul class="checklist">${e.senalesCosecha.map((x) => `<li><span class="caja" aria-hidden="true">${icono('check')}</span>${esc(x)}</li>`).join('')}</ul>
    </section>

    <section class="seccion" aria-labelledby="t-consejos">
      <h2 id="t-consejos">${icono('sol')}Consejos</h2>
      <ol class="numerada">${e.consejos.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    </section>`;
  return { titulo: e.nombre, html };
}

// ----- Mis cultivos -----
function botonRiego(c, clase = 'boton agua') {
  const nombre = esc(nombreCultivo(c));
  if (regadoHoy(c.id)) {
    return `<span class="estado-ok ${recienRegados.has(c.id) ? 'aparece' : ''}" tabindex="-1" data-key="riego-${esc(c.id)}">${icono('check')}Regado hoy<span class="sr"> (${nombre})</span></span>`;
  }
  return `<button type="button" class="${clase}" data-accion="regar" data-id="${esc(c.id)}" data-key="riego-${esc(c.id)}">${icono('gota')}Regué hoy<span class="sr"> (${nombre})</span></button>`;
}

function tarjetaCultivo(c) {
  const e = especieDe(c);
  const info = calcularEtapas(c, e);
  const nombre = nombreCultivo(c);
  const id = esc(c.id);
  const ultimo = ultimoRiego(c.id);
  const nEntradas = estado.bitacora.filter((x) => x.cultivoId === c.id).length;
  const etapaTxt = nombreEtapa(info, e);
  // Con plantín comprado, los días se cuentan desde el trasplante.
  const diaTxt = info.estado === 'programado'
    ? `Faltan ${plural(info.inicioConteo - info.dia, 'día', 'días')}`
    : `Día ${info.dia - info.inicioConteo}`;

  // Barra por etapas: cada tramo se llena según el avance. Las etiquetas van debajo,
  // en una línea que puede partirse (✓ hecha, ● actual), así el estado no depende solo del color.
  const etapas = info.etapas.map((x, i) => {
    const hecha = i < info.actual;
    const actual = i === info.actual;
    const marca = hecha ? icono('check') : actual ? '<span aria-hidden="true">●</span>' : '';
    return `<li class="${hecha ? 'hecha' : ''}" ${actual ? 'aria-current="step"' : ''}>${marca}${x.corto}${hecha ? '<span class="sr"> (completada)</span>' : ''}</li>`;
  }).join('');
  const tramos = info.etapas.map((x, i) => {
    let pct = 0;
    if (i < info.actual) pct = 100;
    else if (i === info.actual) pct = Math.round(((info.dia - x.inicio) / (x.fin - x.inicio)) * 100);
    return `<span><i style="width:${Math.min(Math.max(pct, 0), 100)}%"></i></span>`;
  }).join('');

  const programado = info.estado === 'programado';
  const [verboFuturo, verboPasado] = e.metodoTexto?.directa && c.metodo === 'directa' ? ['Plantación', 'Plantado'] : ['Siembra', 'Sembrado'];
  const datos = info.plantin
    ? [`<li>${icono('cultivos')}${programado ? 'Trasplante' : 'Trasplantado'} ${fmtFechaCorta(c.fechaTrasplante)}</li>`]
    : [`<li>${icono('calendario')}${programado ? verboFuturo : verboPasado} ${fmtFechaCorta(c.fechaSiembra)}</li>`];
  if (c.metodo === 'almacigo' && !programado) {
    datos.push(c.fechaTrasplante
      ? `<li>${icono('cultivos')}Trasplantado ${fmtFechaCorta(c.fechaTrasplante)}</li>`
      : `<li>${icono('cultivos')}Sin trasplantar</li>`);
  }
  if (!programado) datos.push(`<li>${icono('gota')}${ultimo ? `Último riego: ${fmtRelativo(ultimo)}` : 'Sin riegos registrados'}</li>`);
  if (info.estado !== 'terminado') {
    datos.push(`<li>${icono('cosecha')}Cosecha ~${fmtFechaCorta(info.fechaCosechaInicio)}</li>`);
  }

  return `
    <li>
      <article class="tarjeta" aria-labelledby="t-${id}" data-key="card-${id}" tabindex="-1">
        <div class="cultivo-cabecera">
          ${glifo(e, 'medio')}
          <div>
            <h2 id="t-${id}">${esc(nombre)}</h2>
            <p class="sub">${UBICACIONES[c.ubicacion]} · ${textoMetodo(c.metodo, e)}</p>
          </div>
        </div>
        <div class="cultivo-info">
          <div class="etapa-actual">
            <p><span class="rotulo">Etapa</span><strong class="valor">${etapaTxt}</strong></p>
            <p class="dia-ciclo"><strong class="valor">${diaTxt}</strong>${info.estado === 'programado' ? '' : `<span class="rotulo">de ~${info.total - info.inicioConteo}</span>`}</p>
          </div>
          <div class="pista" aria-hidden="true">${tramos}</div>
          <ol class="etapas" aria-label="Etapas">${etapas}</ol>
          <p class="chico" style="margin:10px 0 0">${descripcionEtapa(c, e, info)}</p>
        </div>
        <ul class="cultivo-datos">${datos.join('')}</ul>
        ${c.notas ? `<p class="notas-cultivo">${esc(c.notas)}</p>` : ''}
        <div class="cultivo-acciones">
          ${c.archivado || programado ? '' : botonRiego(c)}
          ${c.archivado ? '' : `<button type="button" class="boton secundario" data-accion="nueva-entrada" data-cultivo="${id}" data-key="anotar-${id}">${icono('mas')}Anotar<span class="sr"> en la bitácora de ${esc(nombre)}</span></button>`}
          <details class="menu-mas">
            <summary data-key="mas-${id}">${icono('opciones')}<span class="sr">Más opciones de ${esc(nombre)}</span></summary>
            <div class="menu-lista">
              <button type="button" class="boton" data-accion="editar-cultivo" data-id="${id}">Editar</button>
              <a class="boton" href="#/bitacora?cultivo=${encodeURIComponent(c.id)}">Ver bitácora (${nEntradas})</a>
              ${c.archivado
                ? `<button type="button" class="boton" data-accion="restaurar" data-id="${id}">Volver a activos</button>`
                : `<button type="button" class="boton" data-accion="archivar" data-id="${id}">Archivar</button>`}
              <button type="button" class="boton peligro-texto" data-accion="eliminar-cultivo" data-id="${id}">Eliminar</button>
            </div>
          </details>
        </div>
      </article>
    </li>`;
}

function vistaCultivos(r) {
  const ver = r.query.get('ver') === 'archivados' ? 'archivados' : 'activos';
  const activos = cultivosActivos();
  const archivados = estado.cultivos.filter((c) => c.archivado);
  const lista = (ver === 'activos' ? activos : archivados)
    .slice()
    .sort((a, b) => b.fechaSiembra.localeCompare(a.fechaSiembra));

  let cuerpo;
  if (!lista.length && ver === 'activos') {
    cuerpo = `
      <div class="vacio">
        ${ilustracionVacia()}
        <h2>${archivados.length ? 'No tienes cultivos activos' : 'Todavía no registras siembras'}</h2>
        <p>Agrega lo que sembraste para seguir su avance, o revisa la guía para ver qué sembrar en ${MESES[new Date().getMonth()]}.</p>
        <div class="acciones" style="justify-content:center">
          <button type="button" class="boton primario" data-accion="nuevo-cultivo" data-key="nuevo-cultivo-vacio">${icono('mas')}Agregar cultivo</button>
          <a class="boton secundario" href="#/guia?filtro=mes">Ver la guía</a>
        </div>
      </div>`;
  } else if (!lista.length) {
    cuerpo = '<div class="vacio"><p>No tienes cultivos archivados.</p></div>';
  } else {
    cuerpo = `<ul class="lista-tarjetas dos-col">${lista.map(tarjetaCultivo).join('')}</ul>`;
  }

  const html = `
    <div class="encabezado-vista encabezado-fila">
      <h1>Mis cultivos</h1>
      <button type="button" class="boton primario" data-accion="nuevo-cultivo" data-key="nuevo-cultivo">${icono('mas')}Agregar</button>
    </div>
    ${archivados.length || ver === 'archivados' ? `
      <fieldset class="campo filtros">
        <legend class="sr">Mostrar</legend>
        <div class="opciones-seg">
          <label><input type="radio" name="ver-cultivos" value="activos" data-filtro="cultivos" data-key="ver-activos" ${ver === 'activos' ? 'checked' : ''}><span>Activos (${activos.length})</span></label>
          <label><input type="radio" name="ver-cultivos" value="archivados" data-filtro="cultivos" data-key="ver-archivados" ${ver === 'archivados' ? 'checked' : ''}><span>Archivados (${archivados.length})</span></label>
        </div>
      </fieldset>` : ''}
    ${cuerpo}`;
  return { titulo: 'Mis cultivos', html };
}

// ----- Bitácora -----
function tituloDia(iso, hoy) {
  const n = diasEntre(iso, hoy);
  const fecha = (mismoAnio(iso) ? fmtSemana : fmtDiaAnio).format(aFecha(iso));
  if (n === 0) return `Hoy · ${fecha}`;
  if (n === 1) return `Ayer · ${fecha}`;
  return capitalizar(fecha);
}

function textoCantidad(e) {
  if (e.tipo !== 'cosecha' || e.cantidad === null) return '';
  return `${num(e.cantidad)} ${UNIDADES[e.unidad]}`;
}

function filaEntrada(e) {
  const c = buscarCultivo(e.cultivoId);
  const tipo = TIPOS[e.tipo];
  const cant = textoCantidad(e);
  const id = esc(e.id);
  const contexto = `${tipo.nombre.toLowerCase()} del ${fmtFecha(e.fecha)}`;
  return `
    <li class="entrada ${e.id === recienAnotada ? 'nueva' : ''}" data-key="entrada-${id}" tabindex="-1">
      <span class="tipo-ico ${e.tipo}" aria-hidden="true">${icono(tipo.svg)}</span>
      <div class="entrada-cuerpo">
        <h3>${tipo.nombre}${cant ? `: ${esc(cant)}` : ''}</h3>
        <p class="meta">${glifo(especieDe(c), 'chico')}${esc(nombreCultivo(c))}</p>
        ${e.texto ? `<p class="texto">${esc(e.texto)}</p>` : ''}
      </div>
      <details class="menu-mas sin-borde">
        <summary data-key="opc-${id}">${icono('opciones')}<span class="sr">Opciones: ${contexto}</span></summary>
        <div class="menu-lista">
          <button type="button" class="boton" data-accion="editar-entrada" data-id="${id}">Editar</button>
          <button type="button" class="boton peligro-texto" data-accion="eliminar-entrada" data-id="${id}">Eliminar</button>
        </div>
      </details>
    </li>`;
}

function vistaBitacora(r) {
  const hoy = hoyISO();
  let fCultivo = r.query.get('cultivo') || '';
  let fTipo = r.query.get('tipo') || '';
  if (fCultivo && !buscarCultivo(fCultivo)) fCultivo = '';
  if (fTipo && !tiene(TIPOS, fTipo)) fTipo = '';

  if (!estado.cultivos.length) {
    return {
      titulo: 'Bitácora',
      html: `
        <div class="encabezado-vista"><h1>Bitácora</h1></div>
        <div class="vacio">
          <span class="glifo grande" aria-hidden="true">${icono('bitacora')}</span>
          <h2>Primero agrega un cultivo</h2>
          <p>La bitácora guarda riegos, abonos, observaciones, plagas y cosechas de cada cultivo.</p>
          <button type="button" class="boton primario" data-accion="nuevo-cultivo" data-key="nuevo-cultivo-vacio">${icono('mas')}Agregar cultivo</button>
        </div>`,
    };
  }

  const entradas = estado.bitacora
    .filter((e) => (!fCultivo || e.cultivoId === fCultivo) && (!fTipo || e.tipo === fTipo))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado.localeCompare(a.creado));

  const grupos = new Map();
  for (const e of entradas) {
    if (!grupos.has(e.fecha)) grupos.set(e.fecha, []);
    grupos.get(e.fecha).push(e);
  }

  const opcionesCultivo = (c) => `<option value="${esc(c.id)}" ${c.id === fCultivo ? 'selected' : ''}>${esc(nombreCultivo(c))}</option>`;
  const activos = cultivosActivos();
  const archivados = estado.cultivos.filter((c) => c.archivado);
  const cultivoFiltrado = fCultivo ? buscarCultivo(fCultivo) : null;

  // Una tarjeta por día, con las entradas en filas.
  const lista = entradas.length
    ? [...grupos].map(([fecha, items]) => `
        <section class="dia" aria-labelledby="d-${fecha}">
          <h2 id="d-${fecha}">${tituloDia(fecha, hoy)}</h2>
          <ul class="tarjeta lista-filas">${items.map(filaEntrada).join('')}</ul>
        </section>`).join('')
    : `<div class="vacio"><p>${fCultivo || fTipo ? 'No hay entradas con estos filtros.' : 'Aún no hay entradas. Registra tu primer riego u observación.'}</p></div>`;

  const html = `
    <div class="encabezado-vista">
      <h1>Bitácora</h1>
      <p role="status">${plural(entradas.length, 'entrada', 'entradas')}${fCultivo || fTipo ? ' con los filtros elegidos' : ''}</p>
    </div>
    <div class="filtros dos">
      <div class="campo" style="margin:0">
        <label for="f-cultivo">Cultivo</label>
        <select id="f-cultivo" data-filtro="cultivo" data-key="filtro-cultivo">
          <option value="">Todos</option>
          ${activos.map(opcionesCultivo).join('')}
          ${archivados.length ? `<optgroup label="Archivados">${archivados.map(opcionesCultivo).join('')}</optgroup>` : ''}
        </select>
      </div>
      <div class="campo" style="margin:0">
        <label for="f-tipo">Tipo</label>
        <select id="f-tipo" data-filtro="tipo" data-key="filtro-tipo">
          <option value="">Todos</option>
          ${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}" ${k === fTipo ? 'selected' : ''}>${t.nombre}</option>`).join('')}
        </select>
      </div>
    </div>
    ${cultivoFiltrado && !cultivoFiltrado.archivado && calcularEtapas(cultivoFiltrado).estado !== 'programado' ? `<div class="acciones" style="margin-bottom:8px">${botonRiego(cultivoFiltrado)}</div>` : ''}
    ${lista}
    <div style="height:72px" aria-hidden="true"></div>
    ${activos.length ? `<button type="button" class="boton primario fab" data-accion="nueva-entrada" data-cultivo="${cultivoFiltrado && !cultivoFiltrado.archivado ? esc(fCultivo) : ''}" data-tipo="${esc(fTipo)}" data-key="fab-entrada">${icono('mas')}Nueva entrada</button>` : ''}`;
  return { titulo: 'Bitácora', html };
}

// ----- Inicio -----
function filaRiego(f) {
  const id = esc(f.c.id);
  const nombre = esc(nombreCultivo(f.c));
  let estadoTxt = `<p class="fila-estado">${f.ultimo ? `Último riego: ${fmtRelativo(f.ultimo)}` : 'Sin riegos registrados'}</p>`;
  if (f.regado) estadoTxt = `<p class="fila-estado regado" aria-hidden="true">${icono('check')}Regado hoy</p>`;
  else if (f.atrasado) estadoTxt = `<p class="fila-estado atrasado">${icono('alerta')}Regado ${fmtRelativo(f.ultimo)} · toca regar</p>`;
  const accion = f.regado
    ? `<span class="hecho ${recienRegados.has(f.c.id) ? 'aparece' : ''}" tabindex="-1" data-key="riego-${id}">${icono('check')}<span class="sr">Regado hoy (${nombre})</span></span>`
    : `<button type="button" class="boton agua compacto" data-accion="regar" data-id="${id}" data-key="riego-${id}">${icono('gota')}Regué hoy<span class="sr"> (${nombre})</span></button>`;
  return `
    <li class="fila">
      ${glifo(f.e)}
      <div class="fila-texto">
        <h3>${esc(f.e.nombreCorto)}</h3>
        ${f.c.apodo ? `<p class="sub">${esc(f.c.apodo)}</p>` : ''}
      </div>
      ${accion}
      ${estadoTxt}
    </li>`;
}

function vistaInicio() {
  const hoy = hoyISO();
  const ahora = new Date();
  const mes = ahora.getMonth() + 1;
  const activos = cultivosActivos();
  const cabecera = `
    <div class="encabezado-vista">
      <h1>Hola</h1>
      <p>${capitalizar(fmtSemana.format(ahora))} · ${capitalizar(estacion(mes))}</p>
    </div>`;

  const necesitaRespaldo = estado.cultivos.length > 0
    && (!estado.preferencias.ultimoRespaldo || diasEntre(estado.preferencias.ultimoRespaldo, hoy) > 30);
  const avisoRespaldo = necesitaRespaldo ? `
    <div class="aviso neutro seccion">
      ${icono('descargar')}
      <p>${estado.preferencias.ultimoRespaldo ? `Tu último respaldo fue ${fmtRelativo(estado.preferencias.ultimoRespaldo)}.` : 'Aún no respaldas tus datos.'}
      Si se limpia el navegador, se pierden. <a href="#/ajustes">Hacer un respaldo</a></p>
    </div>` : '';

  const delMes = `
    <section class="seccion" aria-labelledby="t-sembrar">
      <h2 id="t-sembrar">${icono('calendario')}Para sembrar en ${MESES[mes - 1]}</h2>
      ${tarjetasDelMes(mes) || '<p>Este mes no hay siembras recomendadas.</p>'}
      <a class="enlace-flecha" href="#/guia?filtro=mes">Ver la guía del mes${icono('volver')}</a>
    </section>`;

  if (!activos.length) {
    return {
      titulo: 'Inicio',
      html: `${cabecera}
        <div class="vacio">
          ${ilustracionVacia()}
          <h2>${estado.cultivos.length ? 'No tienes cultivos activos' : '¡Comienza tu huerta!'}</h2>
          <p>Registra lo que sembraste para ver su etapa, anotar riegos y saber cuándo cosechar.</p>
          <div class="acciones" style="justify-content:center">
            <button type="button" class="boton primario" data-accion="nuevo-cultivo" data-key="nuevo-cultivo-vacio">${icono('mas')}Agregar cultivo</button>
            <a class="boton secundario" href="#/guia">Ver la guía</a>
          </div>
        </div>
        ${avisoRespaldo}
        ${delMes}`,
    };
  }

  const filas = activos.map((c) => {
    const e = especieDe(c);
    const info = calcularEtapas(c, e, hoy);
    const ultimo = ultimoRiego(c.id);
    const diasSinRiego = ultimo ? Math.max(0, diasEntre(ultimo, hoy)) : null;
    const regado = regadoHoy(c.id);
    const atrasado = info.estado !== 'programado' && !regado && diasSinRiego !== null && diasSinRiego >= e.riego.diasAlerta;
    // Para ordenar se usan solo los riegos anteriores a hoy: así una fila no salta
    // de lugar al tocar «Regué hoy» (y no queda otro botón bajo el dedo).
    let previo = null;
    for (const x of estado.bitacora) {
      if (x.cultivoId === c.id && x.tipo === 'riego' && x.fecha < hoy && (!previo || x.fecha > previo)) previo = x.fecha;
    }
    const diasPrevio = previo ? diasEntre(previo, hoy) : null;
    const urgencia = diasPrevio === null ? 1 : diasPrevio >= e.riego.diasAlerta ? 0 : 2;
    return { c, e, info, ultimo, diasSinRiego, regado, atrasado, diasPrevio, urgencia };
  });

  // Riego, ordenado por urgencia: atrasados (más días primero), sin registros y el resto.
  const sembrados = filas.filter((f) => f.info.estado !== 'programado');
  sembrados.sort((a, b) => a.urgencia - b.urgencia || (b.diasPrevio ?? 0) - (a.diasPrevio ?? 0));
  const atrasados = sembrados.filter((f) => f.atrasado).length;
  const pendientes = sembrados.filter((f) => !f.regado).length;
  let tituloRiego = 'Nada atrasado hoy';
  if (!pendientes) tituloRiego = 'Todo regado por hoy';
  else if (atrasados) tituloRiego = atrasados === 1 ? '1 cultivo pide agua' : `${atrasados} cultivos piden agua`;

  const riego = sembrados.length ? `
    <section class="tarjeta bloque-riego" aria-labelledby="t-riego">
      <div class="bloque-cabecera">
        <p class="rotulo-seccion agua">${icono('gota')}Riego</p>
        <h2 id="t-riego" ${!pendientes ? 'tabindex="-1" data-key="regar-todos"' : ''}>${tituloRiego}</h2>
      </div>
      <ul class="lista-filas">${sembrados.map(filaRiego).join('')}</ul>
      ${pendientes > 1 ? `
        <div class="bloque-pie">
          <button type="button" class="boton secundario ancho" data-accion="regar-todos" data-key="regar-todos">${icono('gota')}Regué todos</button>
        </div>` : ''}
    </section>` : '';

  // Indicadores: cultivos activos y próxima cosecha
  const enCosecha = filas.filter((f) => f.info.etapa?.id === 'cosecha');
  const proxima = filas
    .filter((f) => f.info.estado !== 'terminado' && f.info.diasParaCosecha > 0)
    .sort((a, b) => a.info.diasParaCosecha - b.info.diasParaCosecha)[0];
  let tileCosecha = '<dd>—<small>Sin fecha estimada</small></dd>';
  if (enCosecha.length) tileCosecha = `<dd class="destacado">¡Ya!<small>${esc(nombreCultivo(enCosecha[0].c))}${enCosecha.length > 1 ? ` y ${enCosecha.length - 1} más` : ''}</small></dd>`;
  else if (proxima) tileCosecha = `<dd>${plural(proxima.info.diasParaCosecha, 'día', 'días')}<small>${esc(nombreCultivo(proxima.c))}</small></dd>`;
  const resumen = `
    <dl class="resumen seccion" aria-label="Resumen">
      <div><dt>Cultivos activos</dt><dd>${activos.length}</dd></div>
      <div><dt>Próxima cosecha</dt>${tileCosecha}</div>
    </dl>`;

  // Próximas cosechas (60 días), con cuenta regresiva a la derecha
  const cosechas = filas
    .filter((f) => f.info.estado !== 'terminado' && f.info.diasParaCosecha <= 60)
    .sort((a, b) => a.info.fechaCosechaInicio.localeCompare(b.info.fechaCosechaInicio));
  const proximas = `
    <section class="seccion" aria-labelledby="t-cosechas">
      <h2 id="t-cosechas">${icono('cosecha')}Próximas cosechas</h2>
      ${cosechas.length ? `
        <ul class="tarjeta lista-filas">
          ${cosechas.map((f) => `
            <li class="fila fila-cosecha">
              ${glifo(f.e)}
              <div class="fila-texto">
                <h3>${esc(nombreCultivo(f.c))}</h3>
                <p class="sub">${f.info.diasParaCosecha <= 0 ? `En cosecha hasta ~${fmtFecha(f.info.fechaCosechaFin)}` : `Desde ~${fmtFecha(f.info.fechaCosechaInicio)}`}</p>
              </div>
              ${f.info.diasParaCosecha <= 0
                ? '<span class="cuenta ya">¡Ya!</span>'
                : `<span class="cuenta"><strong>${f.info.diasParaCosecha}</strong><small>${f.info.diasParaCosecha === 1 ? 'día' : 'días'}</small></span>`}
            </li>`).join('')}
        </ul>` : '<p class="texto-suave">Ningún cultivo llega a cosecha en los próximos 60 días.</p>'}
    </section>`;

  return { titulo: 'Inicio', html: `${cabecera}${riego}${resumen}${avisoRespaldo}${proximas}${delMes}` };
}

// ----- Ajustes y respaldo -----
function puedeCompartirArchivos() {
  try {
    return Boolean(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }));
  } catch { return false; }
}

function vistaAjustes() {
  const p = estado.preferencias;
  const tema = (valor, texto) => `<label><input type="radio" name="tema" value="${valor}" data-filtro="tema" data-key="tema-${valor}" ${p.tema === valor ? 'checked' : ''}><span>${texto}</span></label>`;
  const html = `
    <div class="encabezado-vista">
      <h1>Ajustes y respaldo</h1>
    </div>

    <section class="tarjeta" aria-labelledby="t-tema">
      <h2 id="t-tema">Apariencia</h2>
      <fieldset class="campo" style="margin:0">
        <legend>Tema de colores</legend>
        <div class="opciones-seg">${tema('auto', 'Automático')}${tema('claro', 'Claro')}${tema('oscuro', 'Oscuro')}</div>
        <p class="ayuda">«Automático» sigue la configuración del teléfono. El tema claro se lee mejor a pleno sol.</p>
      </fieldset>
    </section>

    <section class="tarjeta seccion" aria-labelledby="t-respaldo">
      <h2 id="t-respaldo">Respaldo de datos</h2>
      <p>Tus cultivos y tu bitácora se guardan solo en este navegador. Si borras los datos de navegación, se pierden. Descarga un respaldo de vez en cuando y guárdalo en tu correo o en la nube.</p>
      <p><strong>${p.ultimoRespaldo ? `Último respaldo: ${fmtFecha(p.ultimoRespaldo)} (${fmtRelativo(p.ultimoRespaldo)}).` : 'Aún no has hecho un respaldo.'}</strong></p>
      <div class="acciones">
        <button type="button" class="boton primario" data-accion="exportar" data-key="exportar">${icono('descargar')}Descargar respaldo</button>
        ${puedeCompartirArchivos() ? `<button type="button" class="boton secundario" data-accion="compartir" data-key="compartir">Compartir respaldo</button>` : ''}
        <button type="button" class="boton secundario" data-accion="importar" data-key="importar">${icono('subir')}Importar respaldo</button>
      </div>
      <input type="file" id="archivo-importar" accept="application/json,.json" class="sr" tabindex="-1" aria-hidden="true">
    </section>

    <section class="tarjeta seccion" aria-labelledby="t-datos">
      <h2 id="t-datos">Datos guardados</h2>
      <p>Tienes ${plural(estado.cultivos.length, 'cultivo', 'cultivos')} y ${plural(estado.bitacora.length, 'entrada', 'entradas')} de bitácora en este dispositivo.</p>
      <button type="button" class="boton peligro-borde" data-accion="borrar-todo" data-key="borrar-todo">Borrar todos los datos</button>
    </section>

    <section class="seccion texto-suave chico" aria-labelledby="t-acerca">
      <h2 id="t-acerca">Acerca de</h2>
      <p>Cultivador · guía y bitácora para la huerta en casa. Calendario pensado para Penco y la costa del Biobío (hemisferio sur). Funciona sin conexión una vez instalada.</p>
    </section>`;
  return { titulo: 'Ajustes', html };
}

// ---------- Avisos ----------
function anunciar(msg) {
  const a = $('#anunciador');
  a.textContent = '';
  setTimeout(() => { a.textContent = msg; }, 60);
}

let temporizadorToast = null;
function toast(msg, accion = null) {
  const zona = $('#toast-zona');
  clearTimeout(temporizadorToast);
  zona.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<p>${esc(msg)}</p>${accion ? `<button type="button" class="boton">${esc(accion.texto)}</button>` : ''}`;
  const cerrar = () => { clearTimeout(temporizadorToast); el.remove(); };
  const programar = () => { clearTimeout(temporizadorToast); temporizadorToast = setTimeout(cerrar, accion ? 8000 : 4500); };
  if (accion) {
    el.querySelector('button').addEventListener('click', () => { cerrar(); accion.fn(); });
  }
  // Pausa mientras el usuario interactúa con el aviso.
  el.addEventListener('mouseenter', () => clearTimeout(temporizadorToast));
  el.addEventListener('mouseleave', programar);
  el.addEventListener('focusin', () => clearTimeout(temporizadorToast));
  el.addEventListener('focusout', programar);
  zona.append(el);
  anunciar(msg);
  programar();
}

// ---------- Diálogos ----------
function campo(form, nombre) { return form.elements.namedItem(nombre); }

function limpiarErrores(form) {
  for (const el of $$('[aria-invalid]', form)) el.removeAttribute('aria-invalid');
  for (const el of $$('.error', form)) el.textContent = '';
}

function mostrarErrores(form, errores) {
  for (const [nombre, msg] of errores) {
    const el = campo(form, nombre);
    el.setAttribute('aria-invalid', 'true');
    const err = $(`#${el.id}-error`);
    if (err) err.textContent = msg;
  }
  campo(form, errores[0][0]).focus();
}

function confirmar({ titulo, texto, botones }) {
  const dlg = $('#dlg-confirmar');
  $('#dlg-confirmar-titulo').textContent = titulo;
  $('#dlg-confirmar-texto').textContent = texto;
  const lista = botones || [
    { valor: 'cancelar', texto: 'Cancelar', clase: 'secundario' },
    { valor: 'aceptar', texto: 'Aceptar', clase: 'peligro' },
  ];
  const cont = $('#dlg-confirmar-botones');
  cont.innerHTML = lista
    .map((b, i) => `<button type="button" value="${esc(b.valor)}" class="boton ${b.clase}" ${i === 0 ? 'autofocus' : ''}>${esc(b.texto)}</button>`)
    .join('');
  return new Promise((resolver) => {
    let resuelto = false;
    // Esc o tocar el fondo equivalen a cancelar. Se ignora un "close" atrasado
    // de una confirmación anterior si este diálogo sigue abierto.
    const alCerrar = () => { if (!dlg.open) terminar('cancelar'); };
    const terminar = (valor) => {
      if (resuelto) return;
      resuelto = true;
      dlg.removeEventListener('close', alCerrar);
      resolver(valor);
    };
    // Se resuelve en el mismo clic (sin esperar el evento "close", que puede llegar tarde).
    for (const b of $$('button', cont)) {
      b.addEventListener('click', () => { terminar(b.value); dlg.close(); });
    }
    dlg.addEventListener('close', alCerrar);
    dlg.showModal();
  });
}

let origenFoco = null;
let ultimoDisparador = null; // elemento tocado (en Safari los botones no reciben foco al tocarlos)
function recordarOrigen() {
  const a = ultimoDisparador?.isConnected ? ultimoDisparador : document.activeElement;
  ultimoDisparador = null;
  origenFoco = a?.dataset?.key || a?.closest?.('[data-key]')?.dataset.key || null;
  // Si se abrió desde un menú "Más", volvemos a la tarjeta.
  const card = a?.closest?.('article[data-key]');
  if (a?.closest?.('.menu-lista') && card) origenFoco = card.dataset.key;
}

// ----- Formulario de cultivo -----
const dlgCultivo = $('#dlg-cultivo');
const formCultivo = $('#form-cultivo');

function actualizarAyudaMetodo(cambiarMetodo) {
  const e = especiesPorId.get(campo(formCultivo, 'especieId').value);
  const ayuda = $('#c-metodo-ayuda');
  const metodo = campo(formCultivo, 'metodo');
  // Solo se muestran los métodos que tienen sentido para la especie (+ plantín si se hace almácigo).
  const permitidos = e
    ? [...e.siembra.metodos, ...(e.siembra.metodos.includes('almacigo') ? ['plantin'] : [])]
    : Object.keys(METODOS);
  for (const l of $$('[data-metodo]', formCultivo)) {
    l.hidden = !permitidos.includes(l.dataset.metodo) && !(l.dataset.metodo === metodo.value && !cambiarMetodo);
  }
  $('#c-metodo-directa').textContent = e ? textoMetodo('directa', e) : METODOS.directa;
  if (e) {
    const rec = e.siembra.metodoRecomendado;
    if (e.metodoTexto?.directa) ayuda.textContent = `${e.nombreCorto} se planta por dientes, directo en su lugar definitivo.`;
    else if (e.siembra.metodos.length === 1 && rec === 'directa') ayuda.textContent = `${e.nombreCorto} se siembra directo; no le gusta el trasplante.`;
    else ayuda.textContent = `Para ${e.nombreCorto.toLowerCase()} se recomienda: ${textoMetodo(rec, e).toLowerCase()}. Si compraste plantines, elige «Plantín comprado».`;
    const actualOculto = $(`[data-metodo="${metodo.value}"]`, formCultivo)?.hidden;
    if (cambiarMetodo || actualOculto) metodo.value = rec;
  } else {
    ayuda.textContent = '';
  }
  actualizarCampoTrasplante();
}

function actualizarCampoTrasplante() {
  const e = especiesPorId.get(campo(formCultivo, 'especieId').value);
  const metodo = campo(formCultivo, 'metodo').value;
  const plantin = metodo === 'plantin';
  const trasplante = campo(formCultivo, 'fechaTrasplante');
  $('#campo-trasplante').hidden = metodo === 'directa';
  $('#campo-siembra').hidden = plantin;
  $('#c-fecha-texto').textContent = e?.metodoTexto?.directa ? 'Fecha de plantación' : 'Fecha de siembra';
  // Con plantín comprado la fecha de trasplante es obligatoria (es el punto de partida).
  $('#c-trasplante-label').innerHTML = plantin
    ? 'Fecha de trasplante <span class="req" aria-hidden="true">*</span>'
    : 'Fecha de trasplante <span class="opcional">(opcional)</span>';
  $('#c-trasplante-ayuda').textContent = plantin
    ? 'El día en que pusiste el plantín en su lugar definitivo.'
    : 'Complétala cuando pases las plantas a su lugar definitivo.';
  trasplante.required = plantin;
  if (plantin && !trasplante.value) trasplante.value = hoyISO();
  const siembra = campo(formCultivo, 'fechaSiembra').value;
  trasplante.min = plantin ? '' : siembra || '';
}

function abrirFormCultivo(c = null, especieId = null) {
  recordarOrigen();
  formCultivo.reset();
  limpiarErrores(formCultivo);
  const sel = campo(formCultivo, 'especieId');
  const opciones = especies.map((e) => `<option value="${esc(e.id)}">${esc(e.nombre)}</option>`);
  if (c && !especiesPorId.has(c.especieId)) opciones.push(`<option value="${esc(c.especieId)}">Especie desconocida (${esc(c.especieId)})</option>`);
  sel.innerHTML = `<option value="">Elige una especie…</option>${opciones.join('')}`;

  $('#dlg-cultivo-titulo').textContent = c ? 'Editar cultivo' : 'Nuevo cultivo';
  campo(formCultivo, 'id').value = c?.id || '';
  sel.value = c?.especieId || especieId || '';
  campo(formCultivo, 'apodo').value = c?.apodo || '';
  campo(formCultivo, 'fechaSiembra').value = c?.fechaSiembra || hoyISO();
  campo(formCultivo, 'ubicacion').value = c?.ubicacion || 'bancal';
  campo(formCultivo, 'notas').value = c?.notas || '';
  actualizarAyudaMetodo(!c);
  if (c) campo(formCultivo, 'metodo').value = c.metodo;
  campo(formCultivo, 'fechaTrasplante').value = c?.fechaTrasplante || '';
  actualizarCampoTrasplante();
  dlgCultivo.showModal();
}

formCultivo.addEventListener('change', (ev) => {
  if (ev.target.name === 'especieId') actualizarAyudaMetodo(!campo(formCultivo, 'id').value);
  if (ev.target.name === 'metodo' || ev.target.name === 'fechaSiembra') actualizarCampoTrasplante();
});

formCultivo.addEventListener('submit', (ev) => {
  ev.preventDefault();
  limpiarErrores(formCultivo);
  const hoy = hoyISO();
  const v = (n) => campo(formCultivo, n).value.trim();
  const id = v('id');
  const especieId = v('especieId');
  let fechaSiembra = v('fechaSiembra');
  const metodo = tiene(METODOS, v('metodo')) ? v('metodo') : 'directa';
  const fechaTrasplante = metodo === 'directa' ? '' : v('fechaTrasplante');
  const errores = [];
  if (!especieId) errores.push(['especieId', 'Elige qué especie sembraste.']);
  if (metodo === 'plantin') {
    // Se estima la fecha de siembra restando los días típicos de almácigo de la especie.
    if (!esFechaISO(fechaTrasplante)) errores.push(['fechaTrasplante', 'Ingresa la fecha en que trasplantaste el plantín.']);
    else if (fechaTrasplante > sumarDias(hoy, 365)) errores.push(['fechaTrasplante', 'La fecha no puede ser más de un año en el futuro.']);
    else fechaSiembra = sumarDias(fechaTrasplante, -diasAlmacigoEstimados(especiesPorId.get(especieId) || ESPECIE_DESCONOCIDA));
  } else if (!esFechaISO(fechaSiembra)) errores.push(['fechaSiembra', 'Ingresa una fecha válida.']);
  else if (fechaSiembra > sumarDias(hoy, 365)) errores.push(['fechaSiembra', 'La fecha no puede ser más de un año en el futuro.']);
  if (fechaTrasplante && metodo === 'almacigo') {
    if (!esFechaISO(fechaTrasplante)) errores.push(['fechaTrasplante', 'Ingresa una fecha de trasplante válida.']);
    else if (esFechaISO(fechaSiembra) && fechaTrasplante < fechaSiembra) errores.push(['fechaTrasplante', 'El trasplante no puede ser antes de la siembra.']);
  }
  if (errores.length) { mostrarErrores(formCultivo, errores); return; }

  const datos = {
    especieId,
    apodo: v('apodo').slice(0, 40),
    fechaSiembra,
    metodo,
    fechaTrasplante: fechaTrasplante || null,
    ubicacion: tiene(UBICACIONES, v('ubicacion')) ? v('ubicacion') : 'bancal',
    notas: campo(formCultivo, 'notas').value.trim().slice(0, 1000),
    actualizado: new Date().toISOString(),
  };
  let cultivo = id ? buscarCultivo(id) : null;
  if (cultivo) Object.assign(cultivo, datos);
  else {
    cultivo = { id: uid(), ...datos, archivado: false, creado: datos.actualizado };
    estado.cultivos.push(cultivo);
  }
  if (!guardar()) return;
  dlgCultivo.close();
  toast(id ? 'Cultivo actualizado' : `Cultivo agregado: ${nombreCultivo(cultivo)}`);
  const r = parsearHash();
  if (!id && (r.ruta !== 'cultivos' || r.query.get('ver') === 'archivados')) {
    focoPendiente = `card-${cultivo.id}`;
    location.hash = '#/cultivos';
  } else {
    render({ foco: id ? (origenFoco || `card-${cultivo.id}`) : `card-${cultivo.id}` });
  }
});

// ----- Formulario de entrada -----
const dlgEntrada = $('#dlg-entrada');
const formEntrada = $('#form-entrada');

function actualizarCampoCantidad() {
  $('#campo-cantidad').hidden = campo(formEntrada, 'tipo').value !== 'cosecha';
}

function abrirFormEntrada({ entrada = null, cultivoId = '', tipo = 'observacion' } = {}) {
  recordarOrigen();
  formEntrada.reset();
  limpiarErrores(formEntrada);
  const elegido = entrada?.cultivoId || cultivoId;
  const opcion = (c) => `<option value="${esc(c.id)}">${esc(nombreCultivo(c))}</option>`;
  const archivadoElegido = estado.cultivos.filter((c) => c.archivado && c.id === elegido);
  const activos = cultivosActivos();
  campo(formEntrada, 'cultivoId').innerHTML = `
    ${activos.length === 1 && !archivadoElegido.length ? '' : '<option value="">Elige un cultivo…</option>'}
    ${activos.map(opcion).join('')}
    ${archivadoElegido.length ? `<optgroup label="Archivados">${archivadoElegido.map(opcion).join('')}</optgroup>` : ''}`;

  $('#dlg-entrada-titulo').textContent = entrada ? 'Editar entrada' : 'Nueva entrada';
  campo(formEntrada, 'id').value = entrada?.id || '';
  if (elegido) campo(formEntrada, 'cultivoId').value = elegido;
  campo(formEntrada, 'tipo').value = entrada?.tipo || (tiene(TIPOS, tipo) ? tipo : 'observacion');
  const hoy = hoyISO();
  campo(formEntrada, 'fecha').value = entrada?.fecha || hoy;
  campo(formEntrada, 'fecha').max = hoy;
  campo(formEntrada, 'cantidad').value = entrada?.cantidad == null ? '' : String(entrada.cantidad).replace('.', ',');
  campo(formEntrada, 'unidad').value = entrada?.unidad || 'g';
  campo(formEntrada, 'texto').value = entrada?.texto || '';
  actualizarCampoCantidad();
  dlgEntrada.showModal();
}

formEntrada.addEventListener('change', (ev) => {
  if (ev.target.name === 'tipo') actualizarCampoCantidad();
});

formEntrada.addEventListener('submit', (ev) => {
  ev.preventDefault();
  limpiarErrores(formEntrada);
  const v = (n) => campo(formEntrada, n).value.trim();
  const id = v('id');
  const cultivoId = v('cultivoId');
  const fecha = v('fecha');
  const tipo = tiene(TIPOS, v('tipo')) ? v('tipo') : 'observacion';
  const cantidadTxt = v('cantidad');
  const errores = [];
  if (!cultivoId || !buscarCultivo(cultivoId)) errores.push(['cultivoId', 'Elige a qué cultivo corresponde.']);
  if (!esFechaISO(fecha)) errores.push(['fecha', 'Ingresa una fecha válida.']);
  else if (fecha > hoyISO()) errores.push(['fecha', 'La fecha no puede ser futura.']);
  let cantidad = null;
  if (tipo === 'cosecha' && cantidadTxt) {
    cantidad = leerNumero(cantidadTxt);
    if (!Number.isFinite(cantidad)) errores.push(['cantidad', 'Ingresa solo un número, por ejemplo 250 o 1,5.']);
  }
  if (errores.length) { mostrarErrores(formEntrada, errores); return; }

  const datos = {
    cultivoId, fecha, tipo,
    texto: campo(formEntrada, 'texto').value.trim().slice(0, 2000),
    cantidad: tipo === 'cosecha' ? cantidad : null,
    unidad: tiene(UNIDADES, v('unidad')) ? v('unidad') : 'g',
  };
  let entrada = id ? buscarEntrada(id) : null;
  if (entrada) Object.assign(entrada, datos);
  else {
    entrada = { id: uid(), ...datos, creado: new Date().toISOString() };
    estado.bitacora.push(entrada);
  }
  if (!guardar()) return;
  dlgEntrada.close();
  let aviso = id ? 'Entrada actualizada' : `Anotado en la bitácora: ${TIPOS[tipo].nombre.toLowerCase()}`;
  if (!id && tipo === 'cosecha') aviso = cantidad === null ? 'Cosecha anotada' : `Cosecha anotada: ${textoCantidad(entrada)}`;
  toast(aviso);
  recienAnotada = id ? null : entrada.id;
  render({ foco: origenFoco || `entrada-${entrada.id}` });
  recienAnotada = null;
});

// ---------- Acciones ----------
function registrarRiego(ids, claveFoco) {
  const hoy = hoyISO();
  const ahora = new Date().toISOString();
  const nuevas = [];
  for (const id of ids) {
    if (regadoHoy(id)) continue;
    const e = { id: uid(), cultivoId: id, fecha: hoy, tipo: 'riego', texto: '', cantidad: null, unidad: 'g', creado: ahora };
    estado.bitacora.push(e);
    nuevas.push(e);
  }
  if (!nuevas.length || !guardar()) return;
  const boton = ids.length === 1 && ultimoDisparador?.matches?.('[data-accion="regar"]') ? ultimoDisparador : null;
  const mostrar = () => {
    recienRegados = new Set(nuevas.map((n) => n.cultivoId));
    render({ foco: claveFoco });
    recienRegados = new Set();
  };
  if (boton && !menosMovimiento()) {
    boton.classList.add('regando');
    setTimeout(mostrar, 280);
  } else {
    mostrar();
  }
  const msg = nuevas.length === 1
    ? `Riego registrado: ${nombreCultivo(buscarCultivo(nuevas[0].cultivoId))}`
    : `Riego registrado en ${nuevas.length} cultivos`;
  toast(msg, {
    texto: 'Deshacer',
    fn: () => {
      const quitar = new Set(nuevas.map((n) => n.id));
      estado.bitacora = estado.bitacora.filter((e) => !quitar.has(e.id));
      guardar();
      render({ foco: claveFoco });
      anunciar('Riego deshecho');
    },
  });
}

function archivar(id, valor) {
  const c = buscarCultivo(id);
  if (!c) return;
  c.archivado = valor;
  c.actualizado = new Date().toISOString();
  if (!guardar()) return;
  render({ foco: '__titulo' });
  toast(valor ? `Archivado: ${nombreCultivo(c)}` : `De vuelta en activos: ${nombreCultivo(c)}`, {
    texto: 'Deshacer',
    fn: () => { c.archivado = !valor; guardar(); render({ foco: `card-${c.id}` }); anunciar('Acción deshecha'); },
  });
}

async function eliminarCultivo(id) {
  const c = buscarCultivo(id);
  if (!c) return;
  const n = estado.bitacora.filter((e) => e.cultivoId === id).length;
  const r = await confirmar({
    titulo: '¿Eliminar este cultivo?',
    texto: `Se eliminará «${nombreCultivo(c)}»${n ? ` y ${plural(n, 'entrada', 'entradas')} de su bitácora` : ''}. Esta acción no se puede deshacer. Si solo terminó su ciclo, mejor archívalo.`,
    botones: [
      { valor: 'cancelar', texto: 'Cancelar', clase: 'secundario' },
      { valor: 'eliminar', texto: 'Eliminar', clase: 'peligro' },
    ],
  });
  if (r !== 'eliminar') return;
  estado.cultivos = estado.cultivos.filter((x) => x.id !== id);
  estado.bitacora = estado.bitacora.filter((e) => e.cultivoId !== id);
  if (!guardar()) return;
  render({ foco: '__titulo' });
  toast('Cultivo eliminado');
}

async function eliminarEntrada(id) {
  const e = buscarEntrada(id);
  if (!e) return;
  const c = buscarCultivo(e.cultivoId);
  const r = await confirmar({
    titulo: '¿Eliminar esta entrada?',
    texto: `${TIPOS[e.tipo].nombre} del ${fmtFecha(e.fecha)} en ${nombreCultivo(c)}. Esta acción no se puede deshacer.`,
    botones: [
      { valor: 'cancelar', texto: 'Cancelar', clase: 'secundario' },
      { valor: 'eliminar', texto: 'Eliminar', clase: 'peligro' },
    ],
  });
  if (r !== 'eliminar') return;
  estado.bitacora = estado.bitacora.filter((x) => x.id !== id);
  if (!guardar()) return;
  render({ foco: '__titulo' });
  toast('Entrada eliminada');
}

function archivoRespaldo() {
  const contenido = {
    app: 'cultivador',
    version: VERSION_DATOS,
    exportado: new Date().toISOString(),
    datos: { cultivos: estado.cultivos, bitacora: estado.bitacora, preferencias: { tema: estado.preferencias.tema } },
  };
  const nombre = `cultivador-respaldo-${hoyISO()}.json`;
  return new File([JSON.stringify(contenido, null, 2)], nombre, { type: 'application/json' });
}

function marcarRespaldo(clave) {
  estado.preferencias.ultimoRespaldo = hoyISO();
  guardar();
  render({ foco: clave });
}

function exportar() {
  const archivo = archivoRespaldo();
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  marcarRespaldo('exportar');
  toast(`Respaldo descargado: ${archivo.name}`);
}

async function compartir() {
  const archivo = archivoRespaldo();
  try {
    await navigator.share({ files: [archivo], title: 'Respaldo de Cultivador' });
    marcarRespaldo('compartir');
    toast('Respaldo compartido');
  } catch (err) {
    if (err?.name !== 'AbortError') toast('No se pudo compartir. Usa «Descargar respaldo».');
  }
}

async function importarArchivo(archivo) {
  let resultado;
  try {
    if (archivo.size > 5_000_000) throw new Error('El archivo es demasiado grande para ser un respaldo de Cultivador.');
    resultado = normalizar(JSON.parse(await archivo.text()));
  } catch (err) {
    const msg = err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : err.message;
    await confirmar({
      titulo: 'No se pudo importar',
      texto: msg,
      botones: [{ valor: 'ok', texto: 'Entendido', clase: 'primario' }],
    });
    return;
  }
  const { datos, descartados } = resultado;
  const hayDatos = estado.cultivos.length || estado.bitacora.length;
  const resumen = `El archivo trae ${plural(datos.cultivos.length, 'cultivo', 'cultivos')} y ${plural(datos.bitacora.length, 'entrada', 'entradas')}`
    + `${descartados ? ` (se omitirán ${plural(descartados, 'registro dañado', 'registros dañados')})` : ''}.`;
  const opcion = await confirmar({
    titulo: 'Importar respaldo',
    texto: hayDatos
      ? `${resumen} Ahora tienes ${plural(estado.cultivos.length, 'cultivo', 'cultivos')} y ${plural(estado.bitacora.length, 'entrada', 'entradas')}. «Combinar» suma ambos; «Reemplazar» borra lo actual.`
      : `${resumen} ¿Quieres importarlo?`,
    botones: hayDatos
      ? [
        { valor: 'cancelar', texto: 'Cancelar', clase: 'secundario' },
        { valor: 'combinar', texto: 'Combinar', clase: 'secundario' },
        { valor: 'reemplazar', texto: 'Reemplazar todo', clase: 'peligro' },
      ]
      : [
        { valor: 'cancelar', texto: 'Cancelar', clase: 'secundario' },
        { valor: 'reemplazar', texto: 'Importar', clase: 'primario' },
      ],
  });
  if (opcion === 'combinar') {
    const unir = (actual, nuevo) => {
      const mapa = new Map(actual.map((x) => [x.id, x]));
      for (const x of nuevo) mapa.set(x.id, x);
      return [...mapa.values()];
    };
    estado.cultivos = unir(estado.cultivos, datos.cultivos);
    estado.bitacora = unir(estado.bitacora, datos.bitacora);
  } else if (opcion === 'reemplazar') {
    estado.cultivos = datos.cultivos;
    estado.bitacora = datos.bitacora;
  } else {
    return;
  }
  if (!guardar()) return;
  render({ foco: 'importar' });
  toast(opcion === 'combinar' ? 'Respaldo combinado con tus datos' : 'Respaldo importado');
}

async function borrarTodo() {
  const r = await confirmar({
    titulo: '¿Borrar todos los datos?',
    texto: `Se eliminarán ${plural(estado.cultivos.length, 'cultivo', 'cultivos')} y ${plural(estado.bitacora.length, 'entrada', 'entradas')} de este dispositivo. No se puede deshacer. Te recomendamos descargar un respaldo antes.`,
    botones: [
      { valor: 'cancelar', texto: 'Cancelar', clase: 'secundario' },
      { valor: 'borrar', texto: 'Borrar todo', clase: 'peligro' },
    ],
  });
  if (r !== 'borrar') return;
  const tema = estado.preferencias.tema;
  estado = estadoVacio();
  estado.preferencias.tema = tema;
  guardar();
  render({ foco: 'borrar-todo' });
  toast('Se borraron todos los datos');
}

function aplicarTema() {
  const t = estado.preferencias.tema;
  const raiz = document.documentElement;
  if (t === 'claro') raiz.dataset.theme = 'light';
  else if (t === 'oscuro') raiz.dataset.theme = 'dark';
  else delete raiz.dataset.theme;
  for (const m of $$('meta[name="theme-color"]')) {
    m.dataset.original ??= m.content;
    m.content = t === 'claro' ? '#2f6b2f' : t === 'oscuro' ? '#121a12' : m.dataset.original;
  }
}

const ACCIONES = {
  regar: (d) => registrarRiego([d.id], `riego-${d.id}`),
  'regar-todos': () => registrarRiego(
    cultivosActivos().filter((c) => calcularEtapas(c).estado !== 'programado').map((c) => c.id),
    'regar-todos',
  ),
  'nuevo-cultivo': (d) => abrirFormCultivo(null, d.especie || null),
  'editar-cultivo': (d) => { const c = buscarCultivo(d.id); if (c) abrirFormCultivo(c); },
  archivar: (d) => archivar(d.id, true),
  restaurar: (d) => archivar(d.id, false),
  'eliminar-cultivo': (d) => eliminarCultivo(d.id),
  'nueva-entrada': (d) => abrirFormEntrada({ cultivoId: d.cultivo || '', tipo: d.tipo || 'observacion' }),
  'editar-entrada': (d) => { const e = buscarEntrada(d.id); if (e) abrirFormEntrada({ entrada: e }); },
  'eliminar-entrada': (d) => eliminarEntrada(d.id),
  exportar,
  compartir,
  importar: () => $('#archivo-importar')?.click(),
  'borrar-todo': borrarTodo,
  reintentar: () => iniciar(),
};

document.addEventListener('click', (ev) => {
  const cerrar = ev.target.closest('[data-cerrar]');
  if (cerrar) { cerrar.closest('dialog')?.close(); return; }
  const el = ev.target.closest('[data-accion]');
  if (!el) return;
  const fn = tiene(ACCIONES, el.dataset.accion) ? ACCIONES[el.dataset.accion] : null;
  if (fn) {
    ev.preventDefault();
    ultimoDisparador = el;
    fn(el.dataset);
    el.closest('details.menu-mas')?.removeAttribute('open');
  }
});

document.addEventListener('change', (ev) => {
  const t = ev.target;
  switch (t.dataset.filtro) {
    case 'guia': actualizarQuery('filtro', t.value === 'mes' ? 'mes' : null); break;
    case 'cultivos': actualizarQuery('ver', t.value === 'archivados' ? 'archivados' : null); break;
    case 'cultivo': actualizarQuery('cultivo', t.value || null); break;
    case 'tipo': actualizarQuery('tipo', t.value || null); break;
    case 'tema':
      estado.preferencias.tema = TEMAS.includes(t.value) ? t.value : 'auto';
      guardar();
      aplicarTema();
      anunciar(`Tema ${t.value === 'auto' ? 'automático' : t.value} aplicado`);
      break;
    default:
      if (t.id === 'archivo-importar' && t.files?.[0]) {
        const archivo = t.files[0];
        t.value = '';
        importarArchivo(archivo);
      }
  }
});

// Menús «⋯» (details): se cierran al tocar fuera o con Esc.
document.addEventListener('click', (ev) => {
  for (const d of $$('details.menu-mas[open]')) {
    if (!d.contains(ev.target)) d.open = false;
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  const abierto = ev.target.closest?.('details.menu-mas[open]') || $('details.menu-mas[open]');
  if (abierto) {
    abierto.open = false;
    $('summary', abierto).focus();
  }
});

// Cerrar diálogos al tocar el fondo oscuro.
for (const dlg of $$('dialog')) {
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
}

window.addEventListener('hashchange', () => {
  for (const dlg of $$('dialog[open]')) dlg.close();
  const r = parsearHash();
  const clave = claveRuta(r);
  const cambio = clave !== rutaAnterior;
  rutaAnterior = clave;
  render({ navegacion: cambio });
});

// Otra pestaña modificó los datos.
window.addEventListener('storage', (ev) => {
  if (ev.key !== CLAVE) return;
  estado = cargar();
  aplicarTema();
  render();
});

// Si la app queda abierta y cambia el día, recalcula etapas y riegos.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && diaRenderizado && diaRenderizado !== hoyISO()) render();
});

// ---------- Inicio ----------
async function iniciar() {
  aplicarTema();
  vista.innerHTML = '<p class="cargando">Cargando…</p>';
  try {
    const resp = await fetch('data/cultivos.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    especies = json.especies;
    especiesPorId.clear();
    for (const e of especies) especiesPorId.set(e.id, e);
  } catch (err) {
    console.error(err);
    vista.innerHTML = `
      <div class="vacio">
        <span class="glifo grande" aria-hidden="true"><svg><use href="#g-logo"/></svg></span>
        <h1>No se pudo cargar la guía</h1>
        <p>Revisa tu conexión a internet e inténtalo de nuevo.</p>
        <button type="button" class="boton primario" data-accion="reintentar">Reintentar</button>
      </div>`;
    return;
  }
  rutaAnterior = claveRuta(parsearHash());
  render();
}

iniciar();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker no registrado', err));
  });
}
