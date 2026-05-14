
let ESTADO = {
  filas    : 4,
  columnas : 5,
  grilla   : [],        
  paqueteSeleccionado: null,
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


document.addEventListener('DOMContentLoaded', () => {
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('f-fecha').value = hoy;
  document.getElementById('f-fecha').min   = hoy;
  document.getElementById('f-hora').value  = '08:00';

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

      if (f === 0 && c === 0) celda.classList.add('entrada');

      if (pkg) {
        celda.classList.add('ocupada');
        celda.dataset.tipo = pkg.tipo;
        celda.dataset.id   = pkg.id;
        celda.innerHTML = `
          <div class="celda-orden">#${pkg.orden ?? '?'}</div>
          <div class="celda-pkg-id">P${String(pkg.id).padStart(3,'0')}</div>
          <div class="celda-tipo">${pkg.tipo}</div>
        `;
        celda.onclick = () => seleccionarCelda(f, c, pkg);
      } else {
        celda.classList.add('vacia');
        celda.innerHTML = `<i class="bi bi-dash celda-vacia-icon"></i>`;
      }

      fila.appendChild(celda);
    }
    contenedor.appendChild(fila);
  }
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

  const pasos = calcularRuta(0, 0, destFila, destCol);

  pasos.forEach((paso, idx) => {
    const cel = getCelda(paso.f, paso.c);
    if (!cel) return;
    if (idx === 0)             cel.classList.add('entrada');
    else if (idx === pasos.length - 1) cel.classList.add('ruta-destino');
    else                       cel.classList.add('ruta-paso');
  });

  const panel = document.getElementById('ruta-panel');
  panel.style.display = '';

  const distancia = pasos.length - 1;
  document.getElementById('ruta-distancia').textContent =
    `Distancia Manhattan: ${distancia} paso${distancia !== 1 ? 's' : ''} desde la entrada`;

  const stepsEl = document.getElementById('ruta-steps');
  stepsEl.innerHTML = pasos.map((paso, idx) => {
    let cls = '';
    let ico = 'bi-arrow-right';
    let txt = `F${paso.f+1}-C${paso.c+1}`;

    if (idx === 0) {
      cls = 'inicio'; ico = 'bi-door-open'; txt = `Entrada (F1-C1)`;
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

function calcularRuta(fi, ci, fd, cd) {
  const pasos = [{f: fi, c: ci}];
  let f = fi, c = ci;

  while (f !== fd) {
    f += f < fd ? 1 : -1;
    pasos.push({f, c});
  }
  while (c !== cd) {
    c += c < cd ? 1 : -1;
    pasos.push({f, c});
  }
  return pasos;
}

function limpiarResaltadoRuta() {
  document.querySelectorAll('.celda.ruta-paso, .celda.ruta-destino').forEach(el => {
    el.classList.remove('ruta-paso', 'ruta-destino');
  });
}

function limpiarRuta() {
  limpiarResaltadoRuta();
  document.getElementById('ruta-panel').style.display = 'none';
  document.getElementById('info-paquete').style.display = 'none';
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
    const resOrg = await fetch('/organizar_almacen?filas=4&columnas=5');
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
    const res  = await fetch('/organizar_almacen?filas=4&columnas=5');
    const data = await res.json();

    if (data.error) {
      alert('Error: ' + data.error);
      return;
    }

    await cargarAlmacen();

    btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Organizado';
    btn.style.color       = 'var(--verde)';
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


function mostrarMsg(el, tipo, texto) {
  el.className     = `msg ${tipo}`;
  el.textContent   = texto;
  el.style.display = 'block';
}
function ocultarMsg(el) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (el) el.style.display = 'none';
}
