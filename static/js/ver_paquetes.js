function filtrar() {
    const texto  = document.getElementById('buscar').value.toLowerCase();
    const tipo   = document.getElementById('filtro-tipo').value.toLowerCase();
    const estado = document.getElementById('filtro-estado').value.toLowerCase();
    const filas  = document.querySelectorAll('#tabla-paquetes tbody tr');
    filas.forEach(fila => {
      const id   = fila.cells[0].textContent.toLowerCase();
      const tip  = fila.cells[1].textContent.toLowerCase();
      const est  = fila.cells[2].textContent.toLowerCase();
      const desc = fila.cells[5].textContent.toLowerCase();
      const ok = (texto === '' || id.includes(texto) || desc.includes(texto))
              && (tipo   === '' || tip.includes(tipo))
              && (estado === '' || est.includes(estado));
      fila.style.display = ok ? '' : 'none';
    });
  }
  document.getElementById('buscar').addEventListener('input', filtrar);
  document.getElementById('filtro-tipo').addEventListener('change', filtrar);
  document.getElementById('filtro-estado').addEventListener('change', filtrar);

  function organizarAlmacen() {
    const btn = document.getElementById('btn-organizar');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Organizando...';

    fetch('/organizar_almacen?filas=4&columnas=5')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          alert('Error: ' + data.error);
          return;
        }
        data.resultado.forEach(p => {
          const posCell   = document.getElementById('pos-'   + p.paquete_id);
          const ordenCell = document.getElementById('orden-' + p.paquete_id);
          if (posCell)   posCell.textContent   = p.posicion_label;
          if (ordenCell) ordenCell.textContent = p.orden;
        });
        btn.innerHTML = '<i class="bi bi-check-circle"></i> Organizado';
        btn.style.borderColor = '#6ddc94';
        btn.style.color       = '#6ddc94';
      })
      .catch(err => {
        alert('Error de red: ' + err);
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-grid-3x3-gap"></i> Organizar almacén';
      });
  }
