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