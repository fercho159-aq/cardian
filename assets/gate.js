/* Puerta de acceso a la vista previa. Protección ligera para que el sitio en construcción
   no se vea sin usuario y contraseña; no sustituye una autenticación real. */
(function () {
  const KEY = 'cardian_preview';
  const HASH = '544905016f397198695b90cf54653124e4ad839b3c08c68072014bf315c966e8';
  const G = window.CardianGate = {
    isOpen() { try { return localStorage.getItem(KEY) === HASH; } catch (e) { return false; } },
    close() { try { localStorage.removeItem(KEY); } catch (e) {} location.href = '/'; },
    async check(user, pass) {
      const data = new TextEncoder().encode(String(user).trim().toLowerCase() + '|' + String(pass));
      const buf = await crypto.subtle.digest('SHA-256', data);
      const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
      if (hex === HASH) { try { localStorage.setItem(KEY, HASH); } catch (e) {} return true; }
      return false;
    }
  };
  if (document.documentElement.dataset.gated !== undefined && !G.isOpen()) {
    document.documentElement.style.visibility = 'hidden';
    location.replace('/?ir=' + encodeURIComponent(location.pathname + location.search));
  }
})();
