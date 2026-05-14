
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('fecha_salida').min = today;
  document.getElementById('fecha_salida').value = today;
  document.getElementById('hora_salida').value = '08:00';
