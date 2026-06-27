(function () {
  'use strict';

  const ZYCORD_API = 'http://127.0.0.1:47653';
  const SECTION_CLASS = 'section_409aa';

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

  function findSettingsPlugin() {
    const plugins = window.Vencord?.Plugins?.plugins;
    if (!plugins) return null;
    return Object.values(plugins).find((p) => p?.customEntries && typeof p.buildEntry === 'function') || null;
  }

  function findMenuTypes() {
    const { findByProps } = window.Vencord.Webpack;
    const Sa = { SECTION: 1, SIDEBAR_ITEM: 2, PANEL: 3, CATEGORY: 5, CUSTOM: 19 };
    const Button = findByProps('Sizes', 'Looks', 'Colors') || window.Vencord.Webpack.Common.Button;
    const formModule = findByProps('FormTitle', 'FormSection') || findByProps('FormText', 'FormTitle');
    const FormTitle = formModule?.FormTitle;
    const React = window.Vencord.Webpack.Common.React;

    return { Sa, Button, FormTitle, React };
  }

  function registerSection() {
    const settingsPlugin = findSettingsPlugin();
    if (!settingsPlugin) {
      throw new Error('Settings plugin not found');
    }

    const { Sa, Button, FormTitle, React } = findMenuTypes();
    const r = window.Vencord.Webpack.Common.React.createElement;
    const { useState } = React;

    function useCommandRunner() {
      const [output, setOutput] = useState('');
      const [busy, setBusy] = useState(null);

      async function run(cmd) {
        setBusy(cmd);
        try {
          const result = await runCommand(cmd);
          setOutput(result.output || '(no output)');
        } catch (err) {
          setOutput(String(err.message || err));
        } finally {
          setBusy(null);
        }
      }

      return { output, busy, run };
    }

    function Output({ text }) {
      return r('pre', {
        style: {
          margin: '16px 0 0',
          padding: 12,
          borderRadius: 8,
          background: 'var(--background-secondary)',
          color: 'var(--text-normal)',
          fontSize: 12,
          lineHeight: 1.45,
          maxHeight: 280,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }
      }, text || '');
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

    function PluginsPanel() {
      const { output, busy, run } = useCommandRunner();

      return r('div', { className: SECTION_CLASS },
        FormTitle && r(FormTitle, { tag: 'h1' }, 'Plugins'),
        r('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
          r(ActionButton, { cmd: 'ps', label: 'List plugins', busy, run }),
          r(ActionButton, { cmd: 'build', label: 'Build', busy, run })
        ),
        r(Output, { text: output })
      );
    }

    function ZycordPanel() {
      const { output, busy, run } = useCommandRunner();

      return r('div', { className: SECTION_CLASS },
        FormTitle && r(FormTitle, { tag: 'h1' }, 'ZyCord'),
        r('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
          r(ActionButton, { cmd: 'up', label: 'Install', busy, run }),
          r(ActionButton, { cmd: 'down', label: 'Uninstall', busy, run }),
          r(ActionButton, { cmd: 'start', label: 'Restart', busy, run }),
          r(ActionButton, { cmd: 'logs', label: 'Logs', busy, run })
        ),
        r(Output, { text: output })
      );
    }

    function UpdatesPanel() {
      const { output, busy, run } = useCommandRunner();

      return r('div', { className: SECTION_CLASS },
        FormTitle && r(FormTitle, { tag: 'h1' }, 'Updates'),
        r('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
          r(ActionButton, { cmd: 'pull', label: 'Update plugins', busy, run }),
          r(ActionButton, { cmd: 'ps', label: 'Check status', busy, run })
        ),
        r(Output, { text: output })
      );
    }

    function PluginsIcon() {
      return r('svg', { width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': true },
        r('path', { fill: 'currentColor', d: 'M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z' })
      );
    }

    function ZycordIcon() {
      return r('svg', { width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': true },
        r('path', {
          fill: 'currentColor',
          d: 'M12 2 2 7v10l10 5 10-5V7L12 2zm0 2.2 7.5 3.75V16.3L12 20.05 4.5 16.3V7.95L12 4.2z'
        })
      );
    }

    function UpdatesIcon() {
      return r('svg', { width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': true },
        r('path', { fill: 'currentColor', d: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z' })
      );
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

      layout.splice(
        layout.findIndex((e) => e?.key === 'vencord_section') + 1 || 2,
        0,
        {
          key: 'zycord_section',
          type: Sa.SECTION,
          useTitle: () => 'ZyCord',
          buildLayout: () => entries
        }
      );

      return layout;
    };
  }

  waitForVencord()
    .then(() => {
      if (!document.getElementById('zycord-section-style')) {
        const style = document.createElement('style');
        style.id = 'zycord-section-style';
        style.textContent = `.${SECTION_CLASS}{padding:8px 0 16px}`;
        document.head.appendChild(style);
      }
      registerSection();
    })
    .catch((err) => console.error('[ZyCord]', err.message));
})();
