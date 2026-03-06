(function screenStateBootstrap() {
  function toggle(el, hidden) {
    if (!el || !el.classList) return;
    el.classList.toggle("hidden", Boolean(hidden));
  }

  function apply(base) {
    const next = base.nextState;
    const stateMap = base.stateMap || {};
    const refs = base.refs || {};

    if (base.body && base.body.setAttribute) {
      base.body.setAttribute("data-state", next);
      base.body.classList.toggle("hangar-open", next === stateMap.HANGAR);
    }

    toggle(refs.menu, next !== stateMap.MENU);
    toggle(refs.hangar, next !== stateMap.HANGAR);
    toggle(refs.leaderboard, next !== stateMap.LEADERBOARD);
    toggle(refs.campaign, next !== stateMap.CAMPAIGN);
    toggle(refs.online, next !== stateMap.ONLINE);
    toggle(refs.account, next !== stateMap.ACCOUNT);
    toggle(refs.settings, next !== stateMap.SETTINGS);
    toggle(refs.upgradePick, next !== stateMap.PICK);
    toggle(refs.gameover, next !== stateMap.OVER);
    toggle(refs.hud, next !== stateMap.RUN);
  }

  window.StellarScreenState = {
    apply,
  };
})();
