document.addEventListener('DOMContentLoaded', () => {
  const raw = localStorage.getItem('users');
  if (!raw) {
    const defaultUsers = [{ username: 'admin', password: '47258369' }];
    localStorage.setItem('users', JSON.stringify(defaultUsers));
  }

  const loginBtn = document.getElementById('loginBtn');
  const err = document.getElementById('errorMsg');
  const passwordInput = document.getElementById('password');
  const togglePassword = document.getElementById('togglePassword');

  loginBtn.addEventListener('click', () => {
    const username = document.getElementById('username').value.trim();
    const password = passwordInput.value.trim();
    err.innerText = '';

    if (!username || !password) {
      err.innerText = 'Enter username and password.';
      return;
    }

    let users = [];
    try {
      users = JSON.parse(localStorage.getItem('users') || '[]');
    } catch (e) {
      users = [];
    }

    const found = users.find(u => u.username === username && u.password === password);
    if (found) {
      sessionStorage.setItem('loggedInUser', username);
      window.location.href = 'Selection/selection.html';
    } else {
      err.innerText = 'Invalid credentials.';
    }
  });

  togglePassword.addEventListener('click', function () {
    const pwd = passwordInput;
    const icon = this.querySelector('i');
    if (pwd.type === 'password') {
      pwd.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      pwd.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  });

  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
  });
});
