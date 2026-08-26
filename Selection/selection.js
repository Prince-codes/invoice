document.addEventListener('DOMContentLoaded', () => {
  if (!sessionStorage.getItem('loggedInUser')) {
    window.location.replace('../index.html');
    return;
  }

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('loggedInUser');
    window.location.replace('../index.html');
  });
});
