  function togglePass() {
      const input = document.getElementById('password');
      const icon  = document.getElementById('eyeIcon');
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('bi-eye', 'bi-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.replace('bi-eye-slash', 'bi-eye');
      }
    }
  