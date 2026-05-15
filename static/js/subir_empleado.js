 function normalizar(str) {
      return str
        .trim()
        .toLowerCase()
        .normalize('NFD')         
        .replace(/[̀-ͯ]/g, '')      
        .replace(/\s+/g, '')                 
        .replace(/[^a-z0-9]/g, '');          
    }

    function actualizarCorreo() {
      const nombre   = normalizar(document.querySelector('[name="nombre1"]').value);
      const apellido = normalizar(document.querySelector('[name="apellido1"]').value);

      const preview = document.getElementById("correo-preview");
      const valor   = document.getElementById("correo-valor");

      if (nombre && apellido) {
        const correo = nombre + apellido + "@almacenes.com";
        valor.textContent = correo;
        preview.style.display = "flex";
      } else if (nombre || apellido) {
        valor.textContent = (nombre || apellido) + "…@almacenes.com";
        preview.style.display = "flex";
      } else {
        preview.style.display = "none";
      }
    }

    document.querySelector('[name="nombre1"]').addEventListener("input",   actualizarCorreo);
    document.querySelector('[name="apellido1"]').addEventListener("input", actualizarCorreo);
