/**
 * Theme script — runs before React hydration to prevent flash of wrong theme.
 * Injected as raw JS in <head> via dangerouslySetInnerHTML.
 */
export function getThemeScript(): string {
  return `
    (function() {
      try {
        var stored = localStorage.getItem('theme-storage');
        var theme = 'system';
        if (stored) {
          var parsed = JSON.parse(stored);
          if (parsed && parsed.state && parsed.state.theme) {
            theme = parsed.state.theme;
          }
        }
        var effective = theme;
        if (theme === 'system') {
          effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.classList.add(effective);
      } catch (e) {
        document.documentElement.classList.add('light');
      }
    })();
  `;
}
