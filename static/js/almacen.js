let ESTADO = {
  filas    : 4,
  columnas : 5,
  grilla   : [],
  paqueteSeleccionado: null,
  puertas  : [],
  dragOrigen: null,
};

const COLORES_TIPO = {
  'Electrónica' : '#60A5FA',
  'Ropa'        : '#C084FC',
  'Alimentos'   : '#4ADE80',
  'Muebles'     : '#FB923C',
  'Herramientas': '#F5C400',
  'Farmacia'    : '#22D3EE',
  'Juguetes'    : '#F87171',
  'Otro'        : '#888888',
};

let ctxCeldaActual = null;

document.addEventListener('DOMContentLoaded', () => {
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('f-fecha').value = hoy;
  document.getElementById('f-fecha').min   = hoy;
  document.getElementById('f-hora').value  = '08:00';

  document.addEventListener('click', cerrarCtxMenu);
  document.addEventListener('contextmenu', e => {
    if (!e.target.closest('.celda')) cerrarCtxMenu();
  });

  cargarAlmacen();
});

async function cargarAlmacen() {
  const btnR = document.getElementById('btn-recargar');
  btnR.innerHTML = '<i class="bi bi-arrow-clockwise spin me-1"></i>Cargando...';
  btnR.disabled  = true;

  try {
    const res  = await fetch('/api/almacen');
    const data = await res.json();

    if (data.error) { console.error(data.error); return; }

    ESTADO.filas    = data.filas;
    ESTADO.columnas = data.columnas;
    ESTADO.grilla   = data.grilla;
    ESTADO.puertas  = data.puertas || [];

    document.getElementById('cfg-filas').value = data.filas;
    document.getElementById('cfg-cols').value  = data.columnas;
    document.getElementById('cfg-filas-val').textContent = data.filas;
    document.getElementById('cfg-cols-val').textContent  = data.columnas;

    renderGrilla();
    renderSinPosicion(data.sin_posicion);

  } catch (e) {
    console.error('Error cargando almacén:', e);
  } finally {
    btnR.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>Actualizar';
    btnR.disabled  = false;
  }
}

function renderGrilla() {
  const { filas, columnas, grilla } = ESTADO;

  const colH = document.getElementById('col-headers');
  colH.style.gridTemplateColumns = `repeat(${columnas}, 1fr)`;
  colH.innerHTML = Array.from({length:columnas}, (_,j) =>
    `<div class="col-label">C${j+1}</div>`
  ).join('');
  document.getElementById('lbl-grilla').textContent = `${filas} × ${columnas}`;

  const contenedor = document.getElementById('grilla-almacen');
  contenedor.innerHTML = '';

  for (let f = 0; f < filas; f++) {
    const fila = document.createElement('div');
    fila.className = 'grid-row';

    const lbl = document.createElement('div');
    lbl.className   = 'row-label';
    lbl.textContent = `F${f+1}`;
    fila.appendChild(lbl);

    for (let c = 0; c < columnas; c++) {
      const pkg   = grilla[f] ? grilla[f][c] : null;
      const celda = document.createElement('div');
      celda.className = 'celda';
      celda.dataset.fila = f;
      celda.dataset.col  = c;

      if (esCeldaPuerta(f, c)) {
        celda.classList.add('puerta');
      }

      if (pkg) {
        celda.classList.add('ocupada');
        celda.dataset.tipo = pkg.tipo;
        celda.dataset.id   = pkg.id;
        celda.draggable    = true;
        celda.innerHTML = `
          <div class="celda-orden">#${pkg.orden ?? '?'}</div>
          <div class="celda-pkg-id">P${String(pkg.id).padStart(3,'0')}</div>
          <div class="celda-tipo">${pkg.tipo}</div>
        `;
        celda.addEventListener('dragstart', onDragStart);
        celda.onclick = () => seleccionarCelda(f, c, pkg);
      } else if (esCeldaPuerta(f, c)) {
        celda.innerHTML = `<span class="puerta-label"><i class="bi bi-door-open"></i><br>Puerta</span>`;
      } else {
        celda.classList.add('vacia');
        celda.innerHTML = `<i class="bi bi-dash celda-vacia-icon"></i>`;
      }

      celda.addEventListener('dragover',  onDragOver);
      celda.addEventListener('drop',      onDrop);
      celda.addEventListener('dragenter', onDragEnter);
      celda.addEventListener('dragleave', onDragLeave);
      celda.addEventListener('contextmenu', e => abrirCtxMenu(e, f, c));

      fila.appendChild(celda);
    }
    contenedor.appendChild(fila);
  }
}

function onDragStart(e) {
  const celda = e.currentTarget;
  ESTADO.dragOrigen = {
    f: parseInt(celda.dataset.fila),
    c: parseInt(celda.dataset.col),
    id: parseInt(celda.dataset.id),
  };
  celda.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onDragEnter(e) {
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function onDrop(e) {
  e.preventDefault();
  const destCelda = e.currentTarget;
  destCelda.classList.remove('drag-over');

  const origen = ESTADO.dragOrigen;
  if (!origen) return;

  const df = parseInt(destCelda.dataset.fila);
  const dc = parseInt(destCelda.dataset.col);

  if (origen.f === df && origen.c === dc) {
    ESTADO.dragOrigen = null;
    document.querySelectorAll('.celda.dragging').forEach(el => el.classList.remove('dragging'));
    return;
  }

  const pkgDestino = ESTADO.grilla[df] ? ESTADO.grilla[df][dc] : null;

  try {
    const fd = new FormData();
    fd.append('paquete_id', origen.id);
    fd.append('nueva_fila', df);
    fd.append('nueva_col',  dc);
    if (pkgDestino) {
      fd.append('swap_id',     pkgDestino.id);
      fd.append('swap_fila',   origen.f);
      fd.append('swap_col',    origen.c);
    }

    const res  = await fetch('/api/mover_paquete', { method: 'POST', body: fd });
    const data = await res.json();

    if (data.error) {
      console.error('Error moviendo paquete:', data.error);
    } else {
      if (!ESTADO.grilla[df]) ESTADO.grilla[df] = [];
      const pkgOrigen = ESTADO.grilla[origen.f][origen.c];
      ESTADO.grilla[df][dc]         = pkgOrigen;
      ESTADO.grilla[origen.f][origen.c] = pkgDestino || null;
      renderGrilla();
    }
  } catch (err) {
    console.error('Error de red al mover paquete:', err);
  }

  ESTADO.dragOrigen = null;
}

function abrirCtxMenu(e, f, c) {
  e.preventDefault();
  ctxCeldaActual = { f, c };

  const esPuerta = esCeldaPuerta(f, c);
  document.getElementById('ctx-asignar').style.display  = esPuerta ? 'none' : '';
  document.getElementById('ctx-eliminar').style.display = esPuerta ? '' : 'none';

  const menu = document.getElementById('ctx-menu');
  menu.style.display = 'block';
  menu.style.left    = e.pageX + 'px';
  menu.style.top     = e.pageY + 'px';
}

function cerrarCtxMenu() {
  document.getElementById('ctx-menu').style.display = 'none';
  ctxCeldaActual = null;
}

async function ctxAsignarPuerta() {
  if (!ctxCeldaActual) return;
  const { f, c } = ctxCeldaActual;
  cerrarCtxMenu();
  if (!ESTADO.puertas.some(p => (p.f!==undefined && p.c!==undefined && p.f==f && p.c==c) || (Array.isArray(p) && p[0]==f && p[1]==c))) {
    ESTADO.puertas.push({ f, c });
  }
  await guardarPuertas();
  renderGrilla();
}

async function ctxEliminarPuerta() {
  if (!ctxCeldaActual) return;
  const { f, c } = ctxCeldaActual;
  cerrarCtxMenu();
  ESTADO.puertas = ESTADO.puertas.filter(p => !((p.f!==undefined && p.c!==undefined && p.f === f && p.c === c) || (Array.isArray(p) && p[0] === f && p[1] === c)));
  await guardarPuertas();
  renderGrilla();
}

async function guardarPuertas() {
  try {
    await fetch('/api/puertas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puertas: ESTADO.puertas }),
    });
  } catch (e) {
    console.error('Error guardando puertas:', e);
  }
}

function esCeldaPuerta(f, c) {
  return ESTADO.puertas.some(p => (p.f!==undefined && p.c!==undefined && p.f == f && p.c == c) || (Array.isArray(p) && p[0] == f && p[1] == c));
}

function renderSinPosicion(lista) {
  const panel = document.getElementById('panel-sin-pos');
  const cont  = document.getElementById('sin-pos-list');
  const cnt   = document.getElementById('cnt-sin-pos');

  if (!lista || lista.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = '';
  cnt.textContent     = `${lista.length} paquete${lista.length>1?'s':''}`;
  cont.innerHTML = lista.map(p => `
    <div class="sin-pos-item">
      <span style="font-family:'Share Tech Mono',monospace;font-size:0.82rem;">
        P${String(p.id).padStart(3,'0')}
      </span>
      <span style="font-size:0.72rem;color:var(--texto-sec);">${p.tipo}</span>
      <span style="font-size:0.7rem;color:var(--texto-sec);">${p.fecha_salida}</span>
    </div>
  `).join('');
}

function seleccionarCelda(fila, col, pkg) {
  ESTADO.paqueteSeleccionado = { fila, col, pkg };

  document.getElementById('i-id').textContent    = `P${String(pkg.id).padStart(3,'0')}`;
  document.getElementById('i-tipo').textContent  = pkg.tipo;
  document.getElementById('i-estado').textContent= pkg.estado;
  document.getElementById('i-fecha').textContent = pkg.fecha_salida;
  document.getElementById('i-pos').textContent   = `F${fila+1}-C${col+1}`;
  document.getElementById('i-orden').textContent = pkg.orden !== null ? `#${pkg.orden}` : '—';
  document.getElementById('info-paquete').style.display = '';

  document.getElementById('f-buscar-id').value = pkg.id;
  ocultarMsg('msg-buscar');

  mostrarRuta(fila, col, pkg);
}

function mostrarRuta(destFila, destCol, pkg) {
  limpiarResaltadoRuta();

  const { pasos, puertaUsada } = calcularRutaOptima(destFila, destCol);

  pasos.forEach((paso, idx) => {
    const cel = getCelda(paso.f, paso.c);
    if (!cel) return;
    if (idx === 0)                       cel.classList.add('entrada');
    else if (idx === pasos.length - 1)   cel.classList.add('ruta-destino');
    else                                 cel.classList.add('ruta-paso');
  });

  // ── Dibujar línea SVG sobre la grilla ─────────────────────
  dibujarSVGRuta(pasos, pkg);

  const panel = document.getElementById('ruta-panel');
  panel.style.display = '';

  const distancia = pasos.length - 1;
  document.getElementById('ruta-distancia').textContent =
    `Distancia Manhattan: ${distancia} paso${distancia !== 1 ? 's' : ''} desde la puerta F${puertaUsada.f+1}-C${puertaUsada.c+1}`;

  const stepsEl = document.getElementById('ruta-steps');
  stepsEl.innerHTML = pasos.map((paso, idx) => {
    let cls = '';
    let ico = 'bi-arrow-right';
    let txt = `F${paso.f+1}-C${paso.c+1}`;

    if (idx === 0) {
      cls = 'inicio'; ico = 'bi-door-open';
      txt = `Puerta (F${puertaUsada.f+1}-C${puertaUsada.c+1})`;
    } else if (idx === pasos.length - 1) {
      cls = 'destino'; ico = 'bi-box-seam';
      txt = `Destino: P${String(pkg.id).padStart(3,'0')} — F${paso.f+1}-C${paso.c+1}`;
    } else {
      const prev = pasos[idx-1];
      if (paso.f > prev.f)      ico = 'bi-arrow-down';
      else if (paso.f < prev.f) ico = 'bi-arrow-up';
      else if (paso.c > prev.c) ico = 'bi-arrow-right';
      else                      ico = 'bi-arrow-left';
    }
    return `<div class="ruta-step ${cls}"><i class="bi ${ico}"></i>${txt}</div>`;
  }).join('');
}

function calcularRutaOptima(fd, cd) {
  let puertas = ESTADO.puertas;
  if (!puertas || puertas.length === 0) {
    puertas = [{ f: 0, c: 0 }];
  }

  let mejorPuerta = puertas[0];
  let mejorDist   = Infinity;

  for (const p of puertas) {
    const dist = Math.abs(p.f - fd) + Math.abs(p.c - cd);
    if (dist < mejorDist) {
      mejorDist   = dist;
      mejorPuerta = p;
    }
  }

  const pasos = [{ f: mejorPuerta.f, c: mejorPuerta.c }];
  let f = mejorPuerta.f;
  let c = mejorPuerta.c;

  while (f !== fd) { f += f < fd ? 1 : -1; pasos.push({ f, c }); }
  while (c !== cd) { c += c < cd ? 1 : -1; pasos.push({ f, c }); }

  return { pasos, puertaUsada: mejorPuerta };
}

function limpiarResaltadoRuta() {
  document.querySelectorAll('.celda.ruta-paso, .celda.ruta-destino, .celda.entrada').forEach(el => {
    el.classList.remove('ruta-paso', 'ruta-destino', 'entrada');
  });
  // Limpiar también el SVG
  const svg = document.getElementById('svg-ruta');
  if (svg) svg.innerHTML = '';
}

function limpiarRuta() {
  limpiarResaltadoRuta();
  document.getElementById('ruta-panel').style.display    = 'none';
  document.getElementById('info-paquete').style.display  = 'none';
  ESTADO.paqueteSeleccionado = null;
}

function getCelda(f, c) {
  return document.querySelector(`.celda[data-fila="${f}"][data-col="${c}"]`);
}

function buscarPaquete() {
  const id  = parseInt(document.getElementById('f-buscar-id').value);
  const msg = document.getElementById('msg-buscar');

  if (!id || isNaN(id)) {
    mostrarMsg(msg, 'err', 'Ingresa un ID válido.');
    return;
  }

  const { filas, columnas, grilla } = ESTADO;
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const pkg = grilla[f] ? grilla[f][c] : null;
      if (pkg && pkg.id === id) {
        ocultarMsg(msg);
        seleccionarCelda(f, c, pkg);
        document.getElementById('info-paquete').scrollIntoView({behavior:'smooth', block:'nearest'});
        return;
      }
    }
  }
  mostrarMsg(msg, 'err', `Paquete #${id} no encontrado en la grilla. Puede no tener posición aún.`);
  document.getElementById('info-paquete').style.display = 'none';
  limpiarResaltadoRuta();
}

async function agregarPaquete() {
  const tipo  = document.getElementById('f-tipo').value;
  const fecha = document.getElementById('f-fecha').value;
  const hora  = document.getElementById('f-hora').value;
  const desc  = document.getElementById('f-desc').value;
  const msg   = document.getElementById('msg-agregar');
  const btn   = document.getElementById('btn-agregar');

  if (!tipo || !fecha || !hora) {
    mostrarMsg(msg, 'err', 'Completa tipo, fecha y hora.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split spin"></i> Guardando...';

  try {
    const fd = new FormData();
    fd.append('tipo',         tipo);
    fd.append('estado',       'En almacén');
    fd.append('fecha_salida', fecha);
    fd.append('hora_salida',  hora);
    fd.append('descripcion',  desc);

    const res = await fetch('/crear_paquete', { method: 'POST', body: fd });
    if (!res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const err = await res.json();
      mostrarMsg(msg, 'err', err.error || 'Error al crear paquete.');
      return;
    }

    mostrarMsg(msg, 'ok', 'Paquete creado. Organizando almacén...');

    btn.innerHTML = '<i class="bi bi-magic spin"></i> Organizando...';

    const puertasParam = encodeURIComponent(JSON.stringify(ESTADO.puertas));
    const resOrg  = await fetch(
      `/organizar_almacen?filas=${ESTADO.filas}&columnas=${ESTADO.columnas}&puertas=${puertasParam}`
    );
    const dataOrg = await resOrg.json();

    if (dataOrg.error) {
      mostrarMsg(msg, 'info', 'Paquete creado pero error al organizar: ' + dataOrg.error);
    } else {
      mostrarMsg(msg, 'ok', `✓ Listo. ${dataOrg.resultado.length} paquete(s) organizados.`);
    }

    await cargarAlmacen();
    document.getElementById('f-tipo').value = '';
    document.getElementById('f-desc').value = '';

  } catch (e) {
    mostrarMsg(msg, 'err', 'Error de red: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-box-seam"></i> Agregar paquete';
  }
}

async function organizarAlmacen() {
  const btn = document.getElementById('btn-organizar');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-magic spin me-1"></i>Organizando...';

  try {
    const puertasParam = encodeURIComponent(JSON.stringify(ESTADO.puertas));
    const res  = await fetch(
      `/organizar_almacen?filas=${ESTADO.filas}&columnas=${ESTADO.columnas}&puertas=${puertasParam}`
    );
    const data = await res.json();

    if (data.error) {
      alert('Error: ' + data.error);
      return;
    }

    await cargarAlmacen();

    btn.innerHTML     = '<i class="bi bi-check-circle me-1"></i>Organizado';
    btn.style.color   = 'var(--verde)';
    btn.style.borderColor = 'rgba(74,222,128,0.4)';

    setTimeout(() => {
      btn.innerHTML     = '<i class="bi bi-magic me-1"></i>Organizar';
      btn.style.color   = 'var(--amarillo)';
      btn.style.borderColor = 'rgba(245,196,0,0.4)';
      btn.disabled      = false;
    }, 2500);

  } catch(e) {
    alert('Error de red: ' + e.message);
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-magic me-1"></i>Organizar';
  }
}

async function aplicarConfigAlmacen() {
  const filas  = parseInt(document.getElementById('cfg-filas').value);
  const cols   = parseInt(document.getElementById('cfg-cols').value);
  const msg    = document.getElementById('msg-config');
  const btn    = document.getElementById('btn-aplicar-config');

  btn.disabled  = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split spin me-1"></i>Aplicando...';

  try {
    const puertasParam = encodeURIComponent(JSON.stringify(ESTADO.puertas));
    const res  = await fetch(
      `/organizar_almacen?filas=${filas}&columnas=${cols}&puertas=${puertasParam}`
    );
    const data = await res.json();

    if (data.error) {
      mostrarMsg(msg, 'err', data.error);
      return;
    }

    mostrarMsg(msg, 'ok', `Almacén ${filas}×${cols} aplicado.`);
    await cargarAlmacen();

  } catch (e) {
    mostrarMsg(msg, 'err', 'Error de red: ' + e.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Aplicar';
  }
}

function mostrarMsg(el, tipo, texto) {
  el.className     = `msg ${tipo}`;
  el.textContent   = texto;
  el.style.display = 'block';
}

function ocultarMsg(el) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (el) el.style.display = 'none';
}

// ══════════════════════════════════════════════
//  DIBUJAR LÍNEA SVG SOBRE LA GRILLA
//  Mide la posición real de cada celda en pantalla
//  y traza una polilínea animada que une los centros.
// ══════════════════════════════════════════════
function dibujarSVGRuta(pasos, pkg) {
  const svg     = document.getElementById('svg-ruta');
  const wrapper = document.getElementById('grilla-wrapper');
  if (!svg || !wrapper) return;
  svg.innerHTML = '';   // limpiar trazo anterior

  if (pasos.length < 2) return;

  const wRect = wrapper.getBoundingClientRect();

  // Obtener centro de cada celda relativo al wrapper
  const puntos = pasos.map(paso => {
    const cel = getCelda(paso.f, paso.c);
    if (!cel) return null;
    const r = cel.getBoundingClientRect();
    return {
      x: r.left + r.width  / 2 - wRect.left,
      y: r.top  + r.height / 2 - wRect.top,
    };
  }).filter(Boolean);

  if (puntos.length < 2) return;

  const pts = puntos.map(p => `${p.x},${p.y}`).join(' ');

  // ── Polilínea de sombra (negra semitransparente) ──────────
  const sombra = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  sombra.setAttribute('points', pts);
  sombra.setAttribute('fill',         'none');
  sombra.setAttribute('stroke',       'rgba(0,0,0,0.55)');
  sombra.setAttribute('stroke-width', '7');
  sombra.setAttribute('stroke-linecap',  'round');
  sombra.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(sombra);

  // ── Polilínea principal animada ───────────────────────────
  const linea = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  linea.setAttribute('points', pts);
  linea.setAttribute('class',  'ruta-linea');
  svg.appendChild(linea);

  // ── Puntos intermedios ────────────────────────────────────
  puntos.slice(1, -1).forEach(p => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', '4');
    c.setAttribute('class', 'ruta-dot-mid');
    svg.appendChild(c);
  });

  // ── Punto de inicio (verde) ───────────────────────────────
  const ini = puntos[0];
  const dotIni = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dotIni.setAttribute('cx', ini.x); dotIni.setAttribute('cy', ini.y); dotIni.setAttribute('r', '7');
  dotIni.setAttribute('class', 'ruta-dot-inicio');
  svg.appendChild(dotIni);

  // ── Punto de destino (amarillo) ───────────────────────────
  const fin = puntos[puntos.length - 1];
  const dotFin = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dotFin.setAttribute('cx', fin.x); dotFin.setAttribute('cy', fin.y); dotFin.setAttribute('r', '8');
  dotFin.setAttribute('class', 'ruta-dot-fin');
  svg.appendChild(dotFin);

  // ── Etiqueta de distancia en el punto medio ───────────────
  const mid   = puntos[Math.floor(puntos.length / 2)];
  const dist  = pasos.length - 1;
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', mid.x + 10);
  label.setAttribute('y', mid.y - 10);
  label.setAttribute('class', 'ruta-label');
  label.textContent = `${dist} paso${dist !== 1 ? 's' : ''}`;
  svg.appendChild(label);
}

// Calcula pasos intermedios entre dos celdas (usado por SVG)
function calcularPasosTramo(fi, ci, fd, cd) {
  const pasos = [{f: fi, c: ci}];
  let f = fi, c = ci;
  while (f !== fd) { f += f < fd ? 1 : -1; pasos.push({f, c}); }
  while (c !== cd) { c += c < cd ? 1 : -1; pasos.push({f, c}); }
  return pasos;
}

// ══════════════════════════════════════════════
//  MULTI-RUTA — ESTADO Y CONSTANTES
// ══════════════════════════════════════════════
ESTADO.modoMulti      = false;
ESTADO.multiSeleccion = []; // [{fila, col, pkg}, ...]

const COLORES_TRAMO = ['#F5C400','#22D3EE','#C084FC','#4ADE80','#FB923C','#F87171','#60A5FA'];


// ══════════════════════════════════════════════
//  PARCHEAR seleccionarCelda para soporte multi
// ══════════════════════════════════════════════
const _selCelda_orig = seleccionarCelda;
seleccionarCelda = function(fila, col, pkg) {
  if (ESTADO.modoMulti) {
    toggleSeleccionMulti(fila, col, pkg);
    return;
  }
  _selCelda_orig(fila, col, pkg);
};


// ══════════════════════════════════════════════
//  TOGGLE MODO MULTI-RUTA
// ══════════════════════════════════════════════
function toggleModoMulti() {
  ESTADO.modoMulti = !ESTADO.modoMulti;
  const btn = document.getElementById('btn-multi');

  if (ESTADO.modoMulti) {
    btn.classList.add('activo');
    btn.innerHTML = '<i class="bi bi-collection-fill me-1"></i>Multi-ruta ON';
    document.body.classList.add('modo-multi');
    limpiarRuta();
    document.getElementById('barra-flotante').classList.add('visible');
    document.getElementById('panel-multi').style.display = '';
    document.getElementById('multi-distancia-total').style.display = 'none';
    document.getElementById('multi-destinos-list').innerHTML = '';
    _actualizarUI();
  } else {
    limpiarMultiRuta();
  }
}


// ══════════════════════════════════════════════
//  AGREGAR / QUITAR PAQUETE DE SELECCIÓN
// ══════════════════════════════════════════════
function toggleSeleccionMulti(fila, col, pkg) {
  const idx = ESTADO.multiSeleccion.findIndex(s => s.pkg.id === pkg.id);
  const cel = getCelda(fila, col);

  if (idx === -1) {
    ESTADO.multiSeleccion.push({ fila, col, pkg });
    cel.classList.add('seleccionada-multi');
  } else {
    ESTADO.multiSeleccion.splice(idx, 1);
    cel.classList.remove('seleccionada-multi');
  }

  // Redibujar badges numéricos en celdas
  document.querySelectorAll('.badge-multi').forEach(b => b.remove());
  ESTADO.multiSeleccion.forEach((s, i) => {
    const c = getCelda(s.fila, s.col);
    if (!c) return;
    const badge = document.createElement('div');
    badge.className   = 'badge-multi';
    badge.textContent = i + 1;
    c.appendChild(badge);
  });

  _actualizarUI();

  // ── Calcular ruta automáticamente si hay 2 o más paquetes ──
  if (ESTADO.multiSeleccion.length >= 2) {
    calcularMultiRuta();
  } else {
    // Con 0 o 1 paquete limpiar el SVG y el panel de resultados
    limpiarResaltadoRuta();
    // Volver a marcar el único seleccionado si queda uno
    ESTADO.multiSeleccion.forEach(s => {
      const c = getCelda(s.fila, s.col);
      if (c) c.classList.add('seleccionada-multi');
    });
    document.getElementById('multi-distancia-total').style.display = 'none';
    document.getElementById('multi-destinos-list').innerHTML = '';
  }
}


// ── Actualiza barra flotante y texto del panel ──
function _actualizarUI() {
  const n     = ESTADO.multiSeleccion.length;
  const chips = document.getElementById('barra-chips');
  const info  = document.getElementById('barra-info');
  const hdr   = document.getElementById('multi-header-txt');

  // Chips en barra flotante
  if (chips) {
    chips.innerHTML = n === 0
      ? '<span style="font-size:0.78rem;color:#888;">Haz clic en los paquetes que quieres recoger...</span>'
      : ESTADO.multiSeleccion.map((s, i) => {
          const color = COLORES_TRAMO[i % COLORES_TRAMO.length];
          return `<span class="barra-chip" style="color:${color};border-color:${color}55;background:${color}11;">
            ${i+1}. P${String(s.pkg.id).padStart(3,'0')}
          </span>`;
        }).join('');
  }
  if (info) info.innerHTML = `<strong>${n}</strong> seleccionado${n!==1?'s':''}`;

  // Texto en panel lateral
  if (hdr) hdr.innerHTML = n === 0
    ? 'Haz clic en los paquetes de la grilla para seleccionarlos.'
    : `<span style="color:var(--cyan);font-weight:700;">${n} paquete${n>1?'s':''} seleccionado${n>1?'s':''}.</span>
       Presiona <strong style="color:var(--cyan);">Calcular</strong> cuando termines.`;
}


// ══════════════════════════════════════════════
//  ALGORITMO NEAREST NEIGHBOR (vecino más cercano)
//  Parte de la puerta más cercana al conjunto
// ══════════════════════════════════════════════
function nearestNeighbor(destinos) {
  // Elegir la mejor puerta como punto de inicio
  let puertas = ESTADO.puertas;
  if (!puertas || puertas.length === 0) puertas = [{ f: 0, c: 0 }];

  // Puerta con menor suma de distancias a todos los destinos
  let puertaInicio = puertas[0];
  let menorSuma    = Infinity;
  for (const p of puertas) {
    const suma = destinos.reduce((s, d) =>
      s + Math.abs(p.f - d.fila) + Math.abs(p.c - d.col), 0);
    if (suma < menorSuma) { menorSuma = suma; puertaInicio = p; }
  }

  const visitados = new Array(destinos.length).fill(false);
  const orden     = [];
  let posActual   = { f: puertaInicio.f, c: puertaInicio.c };

  for (let paso = 0; paso < destinos.length; paso++) {
    let mejorIdx = -1, mejorDist = Infinity;
    destinos.forEach((d, i) => {
      if (visitados[i]) return;
      const dist = Math.abs(d.fila - posActual.f) + Math.abs(d.col - posActual.c);
      if (dist < mejorDist) { mejorDist = dist; mejorIdx = i; }
    });
    visitados[mejorIdx] = true;
    orden.push({ ...destinos[mejorIdx], distDesdeAnterior: mejorDist });
    posActual = { f: destinos[mejorIdx].fila, c: destinos[mejorIdx].col };
  }

  return { orden, puertaInicio };
}


// ══════════════════════════════════════════════
//  CALCULAR Y MOSTRAR MULTI-RUTA
// ══════════════════════════════════════════════
function calcularMultiRuta() {
  const sel = ESTADO.multiSeleccion;
  if (sel.length < 2) {
    alert('Selecciona al menos 2 paquetes en la grilla.');
    return;
  }

  const { orden: ordenOptimo, puertaInicio } = nearestNeighbor(sel);

  // Paradas: puerta → P1 → P2 → ... → Pn
  const paradas = [
    { f: puertaInicio.f, c: puertaInicio.c, pkg: null },
    ...ordenOptimo.map(o => ({ f: o.fila, c: o.col, pkg: o.pkg }))
  ];

  // Distancia total
  let distTotal = 0;
  paradas.forEach((p, i) => {
    if (i === 0) return;
    distTotal += Math.abs(p.f - paradas[i-1].f) + Math.abs(p.c - paradas[i-1].c);
  });

  // Limpiar y dibujar
  limpiarResaltadoRuta();
  dibujarSVGMulti(paradas);

  // Resaltar celdas destino
  ordenOptimo.forEach(o => {
    const cel = getCelda(o.fila, o.col);
    if (cel) cel.classList.add('ruta-destino');
  });

  // Actualizar panel
  const totalEl = document.getElementById('multi-distancia-total');
  totalEl.style.display = '';
  totalEl.innerHTML =
    `<i class="bi bi-signpost-split me-1"></i>` +
    `Distancia total: <strong>${distTotal}</strong> paso${distTotal!==1?'s':''} &nbsp;·&nbsp; ` +
    `${sel.length} paquetes · Puerta F${puertaInicio.f+1}-C${puertaInicio.c+1}`;

  document.getElementById('multi-destinos-list').innerHTML =
    ordenOptimo.map((o, i) => `
      <div class="multi-destino-item">
        <div class="multi-orden-badge"
             style="background:${COLORES_TRAMO[i%COLORES_TRAMO.length]}22;
                    color:${COLORES_TRAMO[i%COLORES_TRAMO.length]};
                    border:1px solid ${COLORES_TRAMO[i%COLORES_TRAMO.length]}55;">${i+1}</div>
        <div style="flex:1;">
          <span style="font-family:'Share Tech Mono',monospace;font-size:0.85rem;">
            P${String(o.pkg.id).padStart(3,'0')}
          </span>
          <span style="color:#888;font-size:0.75rem;margin-left:0.4rem;">${o.pkg.tipo}</span>
        </div>
        <span style="font-size:0.72rem;color:#888;">F${o.fila+1}-C${o.col+1}</span>
        <span style="font-size:0.7rem;color:#888;margin-left:0.3rem;">+${o.distDesdeAnterior}p</span>
      </div>`
    ).join('');
}


// ══════════════════════════════════════════════
//  DIBUJAR SVG MULTI-TRAMO
//  Cada tramo tiene su propio color y número de orden
// ══════════════════════════════════════════════
function dibujarSVGMulti(paradas) {
  const svg     = document.getElementById('svg-ruta');
  const wrapper = document.getElementById('grilla-wrapper');
  if (!svg || !wrapper) return;
  svg.innerHTML = '';

  const wRect = wrapper.getBoundingClientRect();

  paradas.forEach((parada, i) => {
    if (i === 0) return; // el tramo va de i-1 → i
    const prev  = paradas[i-1];
    const color = COLORES_TRAMO[(i-1) % COLORES_TRAMO.length];

    // Pasos del tramo
    const pasosTramo = calcularPasosTramo(prev.f, prev.c, parada.f, parada.c);
    const puntos = pasosTramo.map(p => {
      const cel = getCelda(p.f, p.c);
      if (!cel) return null;
      const r = cel.getBoundingClientRect();
      return { x: r.left + r.width/2 - wRect.left, y: r.top + r.height/2 - wRect.top };
    }).filter(Boolean);

    if (puntos.length < 2) return;
    const pts = puntos.map(p => `${p.x},${p.y}`).join(' ');

    // Sombra
    const sombra = document.createElementNS('http://www.w3.org/2000/svg','polyline');
    sombra.setAttribute('points', pts);
    sombra.setAttribute('fill','none');
    sombra.setAttribute('stroke','rgba(0,0,0,0.5)');
    sombra.setAttribute('stroke-width','7');
    sombra.setAttribute('stroke-linecap','round');
    sombra.setAttribute('stroke-linejoin','round');
    svg.appendChild(sombra);

    // Línea del tramo
    const linea = document.createElementNS('http://www.w3.org/2000/svg','polyline');
    linea.setAttribute('points', pts);
    linea.setAttribute('fill','none');
    linea.setAttribute('stroke', color);
    linea.setAttribute('stroke-width','3');
    linea.setAttribute('stroke-linecap','round');
    linea.setAttribute('stroke-linejoin','round');
    linea.setAttribute('stroke-dasharray','8 5');
    linea.style.animation = `marcha ${0.4 + (i-1)*0.07}s linear infinite`;
    linea.style.filter    = `drop-shadow(0 0 4px ${color}aa)`;
    svg.appendChild(linea);

    // Badge numérico sobre el destino del tramo
    const fin = puntos[puntos.length - 1];

    const circulo = document.createElementNS('http://www.w3.org/2000/svg','circle');
    circulo.setAttribute('cx', fin.x);
    circulo.setAttribute('cy', fin.y - 20);
    circulo.setAttribute('r','9');
    circulo.setAttribute('fill', color);
    circulo.setAttribute('opacity','0.92');
    svg.appendChild(circulo);

    const numTxt = document.createElementNS('http://www.w3.org/2000/svg','text');
    numTxt.setAttribute('x', fin.x);
    numTxt.setAttribute('y', fin.y - 15);
    numTxt.setAttribute('text-anchor','middle');
    numTxt.setAttribute('font-family','Share Tech Mono, monospace');
    numTxt.setAttribute('font-size','10');
    numTxt.setAttribute('font-weight','700');
    numTxt.setAttribute('fill','#000');
    numTxt.textContent = i;
    svg.appendChild(numTxt);
  });

  // Punto de inicio en la puerta (verde pulsante)
  const cel0 = getCelda(paradas[0].f, paradas[0].c);
  if (cel0) {
    const r0   = cel0.getBoundingClientRect();
    const iniX = r0.left + r0.width/2  - wRect.left;
    const iniY = r0.top  + r0.height/2 - wRect.top;
    const dot  = document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.setAttribute('cx', iniX);
    dot.setAttribute('cy', iniY);
    dot.setAttribute('r','8');
    dot.setAttribute('class','ruta-dot-inicio');
    svg.appendChild(dot);
  }
}


// ══════════════════════════════════════════════
//  LIMPIAR MULTI-RUTA
// ══════════════════════════════════════════════
function limpiarMultiRuta() {
  // Quitar clases y badges de celdas
  ESTADO.multiSeleccion.forEach(s => {
    const cel = getCelda(s.fila, s.col);
    if (cel) {
      cel.classList.remove('seleccionada-multi','ruta-destino');
      cel.querySelectorAll('.badge-multi').forEach(b => b.remove());
    }
  });
  ESTADO.multiSeleccion = [];
  limpiarResaltadoRuta();

  // Ocultar elementos UI
  document.getElementById('barra-flotante').classList.remove('visible');
  document.getElementById('panel-multi').style.display     = 'none';
  document.getElementById('multi-distancia-total').style.display = 'none';
  document.getElementById('multi-destinos-list').innerHTML = '';

  // Desactivar modo
  ESTADO.modoMulti = false;
  document.body.classList.remove('modo-multi');
  const btn = document.getElementById('btn-multi');
  if (btn) {
    btn.classList.remove('activo');
    btn.innerHTML = '<i class="bi bi-collection me-1"></i>Multi-ruta';
  }
}
