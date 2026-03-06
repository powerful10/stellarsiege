(function storageBootstrap() {
  function loadJSON(key, fallbackValue) {
    try {
      const raw = localStorage.getItem(String(key));
      if (!raw) return fallbackValue;
      return JSON.parse(raw);
    } catch {
      return fallbackValue;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(String(key), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(String(key));
      return true;
    } catch {
      return false;
    }
  }

  window.StellarStorage = {
    loadJSON,
    saveJSON,
    remove,
  };
})();
