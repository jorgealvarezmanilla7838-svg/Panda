   function confirmarEliminar(id, nombre) {
      document.getElementById('nombreEmpleado').textContent = nombre;
      document.getElementById('formEliminar').action = '/eliminar_empleado/' + id;
      new bootstrap.Modal(document.getElementById('modalEliminar')).show();
    }
 