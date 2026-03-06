(function loggerBootstrap() {
  const FLAGS = window.StellarFlags || {
    isEnabled: () => false,
  };

  const query = (() => {
    try {
      return new URLSearchParams(window.location.search || "");
    } catch {
      return new URLSearchParams();
    }
  })();

  const devMode = query.get("dev") === "1";
  const verbose = devMode || FLAGS.isEnabled("diagnostics_v1", false);

  function emit(level, event, payload) {
    if (!verbose && level === "debug") return;
    const msg = `[stellar:${level}] ${String(event || "event")}`;
    const body = payload && typeof payload === "object" ? payload : { value: payload };
    if (level === "error") {
      console.error(msg, body);
      return;
    }
    if (level === "warn") {
      console.warn(msg, body);
      return;
    }
    if (level === "debug") {
      console.debug(msg, body);
      return;
    }
    console.info(msg, body);
  }

  window.StellarLogger = {
    debug(event, payload) {
      emit("debug", event, payload);
    },
    info(event, payload) {
      emit("info", event, payload);
    },
    warn(event, payload) {
      emit("warn", event, payload);
    },
    error(event, payload) {
      emit("error", event, payload);
    },
    isVerbose() {
      return verbose;
    },
  };
})();
