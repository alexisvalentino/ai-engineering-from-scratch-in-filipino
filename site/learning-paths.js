(function () {
  var root = document.documentElement;

  function updateThemeIcon() {
    var icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = 'N';
  }

  function applyTheme() {
    root.setAttribute('data-theme', 'light');
    updateThemeIcon();
  }

  function careerGuideFromHash(hash) {
    if (!hash || hash.indexOf('#career-route-') !== 0) return null;
    var id = '';
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch (error) {
      return null;
    }
    var guide = document.getElementById(id);
    return guide && guide.matches('details.career-guide') ? guide : null;
  }

  function syncCareerChoice(guide) {
    document.querySelectorAll('[data-career-choice]').forEach(function (link) {
      if (guide && link.getAttribute('href') === '#' + guide.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function careerScrollBehavior() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  function closeOtherCareerGuides(activeGuide) {
    document.querySelectorAll('details.career-guide').forEach(function (guide) {
      if (guide !== activeGuide) guide.open = false;
    });
  }

  function replaceCareerHash(hash) {
    if (!window.history || typeof window.history.replaceState !== 'function') return;
    var url = window.location.pathname + window.location.search + hash;
    window.history.replaceState(window.history.state, '', url);
  }

  function trackCareerGuide(guide) {
    guide.addEventListener('toggle', function () {
      var hash = '#' + guide.id;
      if (guide.open) {
        syncCareerChoice(guide);
        if (window.location.hash !== hash) replaceCareerHash(hash);
      } else if (window.location.hash === hash) {
        syncCareerChoice(null);
        replaceCareerHash('');
      }
    });
  }

  function revealCareerGuide(hash, moveFocus) {
    var guide = careerGuideFromHash(hash);
    if (!guide) return false;
    closeOtherCareerGuides(guide);
    guide.open = true;
    syncCareerChoice(guide);
    window.requestAnimationFrame(function () {
      var summary = guide.querySelector('summary');
      if (moveFocus && summary) {
        try {
          summary.focus({ preventScroll: true });
        } catch (error) {
          summary.focus();
        }
      }
      guide.scrollIntoView({
        behavior: careerScrollBehavior(),
        block: 'start'
      });
    });
    return true;
  }

  applyTheme();

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-career-choice]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        var hash = link.getAttribute('href');
        if (!careerGuideFromHash(hash)) return;
        event.preventDefault();
        if (window.location.hash === hash) revealCareerGuide(hash, true);
        else window.location.hash = hash;
      });
    });

    document.querySelectorAll('details.career-guide').forEach(trackCareerGuide);

    if (!revealCareerGuide(window.location.hash, false)) syncCareerChoice(null);
  });

  window.addEventListener('hashchange', function () {
    if (!revealCareerGuide(window.location.hash, true)) syncCareerChoice(null);
  });

})();
