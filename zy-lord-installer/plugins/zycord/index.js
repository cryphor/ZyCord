(function () {
  'use strict';

  const ZYCORD_API = 'http://127.0.0.1:47653';
  const SECTION_CLASS = 'section_409aa';
  const CREATOR_UID = '1200586798871621763';
  const BADGE_ID = 'zycord_creator_badge';

  const PANELS = {
    plugins: {
      title: 'Plugins',
      description: 'Manage installed plugins.',
      actions: [
        { cmd: 'ps', label: 'List plugins' },
        { cmd: 'build', label: 'Build' }
      ]
    },
    zycord: {
      title: 'ZyCord',
      description: 'Core install and runtime controls.',
      actions: [
        { cmd: 'up', label: 'Install' },
        { cmd: 'down', label: 'Uninstall' },
        { cmd: 'start', label: 'Restart' },
        { cmd: 'logs', label: 'Logs' }
      ]
    },
    updates: {
      title: 'Updates',
      description: 'Keep plugins and patches up to date.',
      actions: [
        { cmd: 'pull', label: 'Update plugins' },
        { cmd: 'ps', label: 'Check status' }
      ]
    }
  };

  const STYLES = `
    .${SECTION_CLASS} {
      padding: 60px 40px 80px;
      max-width: 740px;
    }
    .zycord-panel-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 4px;
    }
    .zycord-output-wrap {
      margin-top: 20px;
    }
    .zycord-output-label {
      display: block;
      margin-bottom: 8px;
      color: var(--header-secondary);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .zycord-output {
      margin: 0;
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid var(--border-faint);
      background: var(--background-secondary);
      color: var(--text-normal);
      font-family: var(--font-code);
      font-size: 12px;
      line-height: 1.5;
      max-height: 300px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .zycord-profile-badge {
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      cursor: pointer;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
      transition: transform 0.15s ease, filter 0.15s ease;
    }
    .zycord-profile-badge:hover {
      transform: scale(1.1);
      filter: drop-shadow(0 2px 6px rgba(88, 101, 242, 0.45));
    }
    .zycord-profile-badge svg {
      display: block;
    }
  `;

  async function runCommand(cmd) {
    const res = await fetch(`${ZYCORD_API}/${cmd}`, { method: 'POST' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed (${res.status})`);
    }
    return res.json();
  }

  function waitForVencord(timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      if (window.Vencord?.Webpack?.Common?.React) {
        resolve();
        return;
      }

      const started = Date.now();
      const timer = setInterval(() => {
        if (window.Vencord?.Webpack?.Common?.React) {
          clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          reject(new Error('Webpack not ready'));
        }
      }, 250);
    });
  }

  function injectStyles() {
    if (document.getElementById('zycord-section-style')) {
      return;
    }
    const style = document.createElement('style');
    style.id = 'zycord-section-style';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function getWebpackUi() {
    const { findByProps } = window.Vencord.Webpack;
    const Sa = { SECTION: 1, SIDEBAR_ITEM: 2, PANEL: 3, CATEGORY: 5, CUSTOM: 19 };
    const Button = findByProps('Sizes', 'Looks', 'Colors') || window.Vencord.Webpack.Common.Button;
    const Forms = findByProps('FormTitle', 'FormSection', 'FormDivider') || {};
    const Margins = findByProps('marginBottom20', 'marginTop20', 'marginReset') || {};
    const React = window.Vencord.Webpack.Common.React;

    return {
      Sa,
      Button,
      FormTitle: Forms.FormTitle,
      FormText: Forms.FormText,
      FormSection: Forms.FormSection,
      FormDivider: Forms.FormDivider,
      Margins,
      React,
      r: window.Vencord.Webpack.Common.React.createElement
    };
  }

  function findSettingsPlugin() {
    const plugins = window.Vencord?.Plugins?.plugins;
    if (!plugins) return null;
    return Object.values(plugins).find((p) => p?.customEntries && typeof p.buildEntry === 'function') || null;
  }

  function ZycordHexIcon({ size = 20, gradientId = 'zycord-icon-grad' }) {
    const { r } = getWebpackUi();
    return r('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      'aria-hidden': true
    },
      r('defs', null,
        r('linearGradient', { id: gradientId, x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
          r('stop', { offset: '0%', stopColor: '#5865F2' }),
          r('stop', { offset: '45%', stopColor: '#7C5CFF' }),
          r('stop', { offset: '100%', stopColor: '#EB459E' })
        )
      ),
      r('path', {
        fill: `url(#${gradientId})`,
        d: 'M12 2 2 7v10l10 5 10-5V7L12 2zm0 2.2 7.5 3.75V16.3L12 20.05 4.5 16.3V7.95L12 4.2z'
      })
    );
  }

  function registerBadge() {
    const badges = window.Vencord?.Api?.Badges;
    if (!badges?.addProfileBadge) {
      return;
    }

    const { addProfileBadge, BadgePosition } = badges;

    if (window.__ZYCORD_BADGE_REGISTERED__) {
      return;
    }
    window.__ZYCORD_BADGE_REGISTERED__ = true;
    const { r, React } = getWebpackUi();

    function ZycordProfileBadge() {
      const gradientId = React.useId ? `zycord-badge-${React.useId().replace(/:/g, '')}` : `zycord-badge-${Math.random().toString(36).slice(2)}`;

      return r('div', { className: 'zycord-profile-badge', 'aria-label': 'ZyCord' },
        r('svg', { width: 22, height: 22, viewBox: '0 0 24 24' },
          r('defs', null,
            r('linearGradient', { id: gradientId, x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
              r('stop', { offset: '0%', stopColor: '#5865F2' }),
              r('stop', { offset: '50%', stopColor: '#8B5CF6' }),
              r('stop', { offset: '100%', stopColor: '#F47FFF' })
            ),
            r('filter', { id: `${gradientId}-glow` },
              r('feDropShadow', { dx: '0', dy: '1', stdDeviation: '1.2', floodColor: '#5865F2', floodOpacity: '0.55' })
            )
          ),
          r('circle', { cx: 12, cy: 12, r: 11, fill: `url(#${gradientId})`, filter: `url(#${gradientId}-glow)` }),
          r('path', {
            fill: '#ffffff',
            d: 'M12 5.2 6.8 8v5.1L12 16l5.2-2.9V8L12 5.2zm0 1.6 3.4 1.9v3.8L12 13.6 8.6 11.7V8.7L12 6.8z'
          })
        )
      );
    }

    addProfileBadge({
      id: BADGE_ID,
      description: 'ZyCord',
      component: ZycordProfileBadge,
      position: BadgePosition?.START ?? 0,
      shouldShow: ({ userId }) => userId === CREATOR_UID
    });
  }

  function registerSection() {
    const settingsPlugin = findSettingsPlugin();
    if (!settingsPlugin) {
      throw new Error('Settings plugin not found');
    }

    const ui = getWebpackUi();
    const { Sa, Button, FormTitle, FormText, FormDivider, Margins, React, r } = ui;
    const { useState } = React;

    function useCommandRunner() {
      const [output, setOutput] = useState('');
      const [busy, setBusy] = useState(null);

      async function run(cmd) {
        setBusy(cmd);
        try {
          const result = await runCommand(cmd);
          setOutput(result.output || '');
        } catch (err) {
          setOutput(String(err.message || err));
        } finally {
          setBusy(null);
        }
      }

      return { output, busy, run };
    }

    function ActionButton({ cmd, label, busy, run }) {
      return r(Button, {
        size: Button.Sizes?.SMALL,
        look: Button.Looks?.FILLED,
        color: Button.Colors?.BRAND,
        disabled: !!busy,
        onClick: () => run(cmd)
      }, busy === cmd ? `${label}...` : label);
    }

    function Panel({ config }) {
      const { output, busy, run } = useCommandRunner();

      return r('div', { className: SECTION_CLASS },
        FormTitle && r(FormTitle, { tag: 'h1' }, config.title),
        FormText && r(FormText, {
          type: 'description',
          className: Margins.marginBottom20
        }, config.description),
        FormDivider && r(FormDivider),
        r('div', { className: 'zycord-panel-actions' },
          ...config.actions.map(({ cmd, label }) =>
            r(ActionButton, { key: cmd, cmd, label, busy, run })
          )
        ),
        r('div', { className: 'zycord-output-wrap' },
          r('span', { className: 'zycord-output-label' }, 'Output'),
          r('pre', { className: 'zycord-output' }, output || '—')
        )
      );
    }

    function PluginsIcon() {
      return r('svg', { width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': true },
        r('path', { fill: 'currentColor', d: 'M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z' })
      );
    }

    function UpdatesIcon() {
      return r('svg', { width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': true },
        r('path', { fill: 'currentColor', d: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z' })
      );
    }

    function ZycordIcon() {
      return r(ZycordHexIcon, { size: 20, gradientId: 'zycord-sidebar-grad' });
    }

    function PluginsPanel() {
      return r(Panel, { config: PANELS.plugins });
    }

    function ZycordPanel() {
      return r(Panel, { config: PANELS.zycord });
    }

    function UpdatesPanel() {
      return r(Panel, { config: PANELS.updates });
    }

    const originalBuildLayout = settingsPlugin.buildLayout.bind(settingsPlugin);

    settingsPlugin.buildLayout = function (root) {
      const layout = originalBuildLayout(root);

      if (root.key !== '$Root' || !Array.isArray(layout) || layout.some((e) => e?.key === 'zycord_section')) {
        return layout;
      }

      const entries = [
        settingsPlugin.buildEntry({
          key: 'zycord_plugins',
          title: 'Plugins',
          panelTitle: 'Plugins',
          Component: PluginsPanel,
          Icon: PluginsIcon
        }),
        settingsPlugin.buildEntry({
          key: 'zycord_main',
          title: 'ZyCord',
          panelTitle: 'ZyCord',
          Component: ZycordPanel,
          Icon: ZycordIcon
        }),
        settingsPlugin.buildEntry({
          key: 'zycord_updates',
          title: 'Updates',
          panelTitle: 'Updates',
          Component: UpdatesPanel,
          Icon: UpdatesIcon
        })
      ];

      const vencordIndex = layout.findIndex((e) => e?.key === 'vencord_section');
      const insertAt = vencordIndex === -1 ? 2 : vencordIndex + 1;

      layout.splice(insertAt, 0, {
        key: 'zycord_section',
        type: Sa.SECTION,
        useTitle: () => 'ZyCord',
        buildLayout: () => entries
      });

      return layout;
    };
  }

  waitForVencord()
    .then(() => {
      injectStyles();
      registerBadge();
      registerSection();
    })
    .catch((err) => console.error('[ZyCord]', err.message));
})();
