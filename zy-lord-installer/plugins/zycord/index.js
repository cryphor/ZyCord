(function () {
  'use strict';

  const ZYCORD_API = 'http://127.0.0.1:47653';
  const DEFAULT_REPO_URL = 'https://github.com/cryphor/ZyCord';
  const SECTION_CLASS = 'section_409aa';
  const CREATOR_UID = '1200586798871621763';
  const BADGE_ID = 'zycord_creator_badge';

  const STYLES = `
    .${SECTION_CLASS} {
      padding: 60px 40px 80px;
      max-width: 740px;
    }
    .zycord-repo-link {
      color: var(--text-link);
      cursor: pointer;
    }
    .zycord-repo-link:hover {
      text-decoration: underline;
    }
    .zycord-update-entry {
      margin-top: 0.5em;
      margin-bottom: 0.5em;
    }
    .zycord-update-entry code {
      font-family: var(--font-code);
      font-size: 0.9em;
    }
    .zycord-update-message {
      margin-left: 0.5em;
      color: var(--text-default);
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.output || `Failed (${res.status})`);
    }
    return data;
  }

  async function fetchUpdates() {
    const res = await fetch(`${ZYCORD_API}/updates`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Failed (${res.status})`);
    }
    return data;
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
    const Flex = findByProps('align', 'justify', 'wrap') || null;
    const Toasts = findByProps('show', 'Type', 'Position') || null;
    const React = window.Vencord.Webpack.Common.React;

    return {
      Sa,
      Button,
      FormTitle: Forms.FormTitle,
      FormText: Forms.FormText,
      FormSection: Forms.FormSection,
      FormDivider: Forms.FormDivider,
      Margins,
      Flex,
      Toasts,
      React,
      r: React.createElement
    };
  }

  function openExternal(url) {
    if (window.VencordNative?.native?.openExternal) {
      window.VencordNative.native.openExternal(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
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
    const { Button, FormTitle, FormText, FormDivider, Margins, Flex, Toasts, React, r } = ui;
    const { useState, useEffect } = React;

    function showToast(message, type = 'message') {
      if (!Toasts?.show) return;
      const toastType = Toasts.Type?.[type.toUpperCase()] ?? Toasts.Type?.MESSAGE;
      Toasts.show({
        id: Toasts.genId?.() ?? `zycord-${Date.now()}`,
        message,
        type: toastType
      });
    }

    function RepoLink({ children, href }) {
      return r('a', {
        className: 'zycord-repo-link',
        href,
        onClick: (e) => {
          e.preventDefault();
          openExternal(href);
        }
      }, children);
    }

    function QuickActionPill({ icon: Icon, text, onClick, disabled }) {
      return r('button', {
        type: 'button',
        className: 'vc-settings-quickActions-pill',
        onClick,
        disabled
      },
        Icon && r(Icon, { className: 'vc-settings-quickActions-img' }),
        text
      );
    }

    function QuickActionsCard({ children }) {
      return r('div', { className: 'vc-settings-quickActions-card' }, children);
    }

    function useSilentCommand() {
      const [busy, setBusy] = useState(null);

      async function run(cmd, successMessage) {
        setBusy(cmd);
        try {
          await runCommand(cmd);
          showToast(successMessage || 'Done', 'success');
        } catch (err) {
          showToast(String(err.message || err), 'failure');
        } finally {
          setBusy(null);
        }
      }

      return { busy, run };
    }

    function SourceCodeIcon(props) {
      return r('svg', { ...props, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
        r('path', { d: 'M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z' })
      );
    }

    function BuildIcon(props) {
      return r('svg', { ...props, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
        r('path', { d: 'M22.7 19.3 12 2 1.3 19.3h21.4zM12 18l-5.5-9h11L12 18z' })
      );
    }

    function InstallIcon(props) {
      return r('svg', { ...props, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
        r('path', { d: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z' })
      );
    }

    function UninstallIcon(props) {
      return r('svg', { ...props, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
        r('path', { d: 'M19 13H5v-2h14v2z' })
      );
    }

    function RestartIcon(props) {
      return r('svg', { ...props, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
        r('path', { d: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z' })
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
      const { busy, run } = useSilentCommand();

      return r('div', { className: SECTION_CLASS },
        FormTitle && r(FormTitle, { tag: 'h1' }, 'Plugins'),
        FormText && r(FormText, {
          type: 'description',
          className: Margins.marginBottom20,
          style: { color: 'var(--text-muted)' }
        }, 'Manage installed plugins.'),
        r('section', null,
          FormTitle && r(FormTitle, { tag: 'h5' }, 'Quick Actions'),
          r(QuickActionsCard, null,
            r(QuickActionPill, {
              icon: BuildIcon,
              text: busy === 'build' ? 'Building...' : 'Build',
              disabled: !!busy,
              onClick: () => run('build', 'Build complete')
            }),
            r(QuickActionPill, {
              icon: SourceCodeIcon,
              text: 'View Source Code',
              onClick: () => openExternal(DEFAULT_REPO_URL)
            })
          )
        )
      );
    }

    function ZycordPanel() {
      const { busy, run } = useSilentCommand();

      return r('div', { className: SECTION_CLASS },
        FormTitle && r(FormTitle, { tag: 'h1' }, 'ZyCord'),
        FormText && r(FormText, {
          type: 'description',
          className: Margins.marginBottom20,
          style: { color: 'var(--text-muted)' }
        }, 'Core install and runtime controls.'),
        r('section', null,
          FormTitle && r(FormTitle, { tag: 'h5' }, 'Quick Actions'),
          r(QuickActionsCard, null,
            r(QuickActionPill, {
              icon: InstallIcon,
              text: busy === 'up' ? 'Installing...' : 'Install',
              disabled: !!busy,
              onClick: () => run('up', 'Install complete')
            }),
            r(QuickActionPill, {
              icon: UninstallIcon,
              text: busy === 'down' ? 'Uninstalling...' : 'Uninstall',
              disabled: !!busy,
              onClick: () => run('down', 'Uninstall complete')
            }),
            r(QuickActionPill, {
              icon: RestartIcon,
              text: busy === 'start' ? 'Restarting...' : 'Relaunch Discord',
              disabled: !!busy,
              onClick: () => run('start', 'Restarting Discord')
            }),
            r(QuickActionPill, {
              icon: SourceCodeIcon,
              text: 'View Source Code',
              onClick: () => openExternal(DEFAULT_REPO_URL)
            })
          )
        )
      );
    }

    function CommitLink({ hash, fullHash, repo }) {
      if (!hash) return 'unknown';
      const href = `${repo || DEFAULT_REPO_URL}/commit/${fullHash || hash}`;
      return r(RepoLink, { href }, hash);
    }

    function UpdatesPanel() {
      const [info, setInfo] = useState(null);
      const [checking, setChecking] = useState(true);
      const [error, setError] = useState(null);

      async function check() {
        setChecking(true);
        setError(null);
        try {
          const data = await fetchUpdates();
          setInfo(data);
          if (data.error) {
            setError(data.error);
          }
        } catch (err) {
          setError(String(err.message || err));
        } finally {
          setChecking(false);
        }
      }

      useEffect(() => {
        check();
      }, []);

      const hasUpdate = info && info.upToDate === false;
      const repo = info?.repo || DEFAULT_REPO_URL;
      const repoSlug = info?.repoSlug || repo.replace('https://github.com/', '');
      const versionLabel = info?.version ? `v${info.version}` : null;

      return r('div', { className: SECTION_CLASS },
        FormTitle && r(FormTitle, { tag: 'h1' }, 'Updates'),
        FormDivider && r(FormDivider, { className: Margins.marginBottom20 }),
        FormTitle && r(FormTitle, { tag: 'h5' }, 'Repo'),
        FormText && r(FormText, null,
          r(RepoLink, { href: repo }, repoSlug),
          ' ',
          versionLabel && `(${versionLabel})`,
          info?.commit && [
            ' (',
            r(CommitLink, { hash: info.commit, fullHash: info.commitFull, repo }),
            ')'
          ]
        ),
        FormDivider && r(FormDivider, { className: `${Margins.marginTop16 || ''} ${Margins.marginBottom16 || ''}`.trim() }),
        FormTitle && r(FormTitle, { tag: 'h5' }, 'Updates'),
        error && FormText && r(FormText, { className: Margins.marginBottom8 },
          'Failed to check updates. ',
          error
        ),
        !error && FormText && r(FormText, { className: Margins.marginBottom8 },
          checking ? 'Checking...' : (hasUpdate ? 'There is 1 Update' : 'Up to Date!')
        ),
        hasUpdate && r('div', { style: { padding: '0 0.5em' } },
          r('div', { className: 'zycord-update-entry' },
            r('code', null,
              r(CommitLink, {
                hash: info.remoteCommit,
                fullHash: info.remoteCommitFull,
                repo
              })
            ),
            r('span', { className: 'zycord-update-message' },
              info.message,
              info.author ? ` - ${info.author}` : ''
            )
          )
        ),
        Flex
          ? r(Flex, { className: `${Margins.marginTop8 || ''} ${Margins.marginBottom8 || ''}`.trim() },
            Button && r(Button, {
              size: Button.Sizes?.SMALL,
              look: Button.Looks?.FILLED,
              color: Button.Colors?.BRAND,
              disabled: checking,
              onClick: check
            }, checking ? 'Checking...' : 'Check for Updates')
          )
          : Button && r(Button, {
            size: Button.Sizes?.SMALL,
            look: Button.Looks?.FILLED,
            color: Button.Colors?.BRAND,
            disabled: checking,
            onClick: check,
            style: { marginTop: 8 }
          }, checking ? 'Checking...' : 'Check for Updates')
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

      const vencordIndex = layout.findIndex((e) => e?.key === 'vencord_section');
      const insertAt = vencordIndex === -1 ? 2 : vencordIndex + 1;

      layout.splice(insertAt, 0, {
        key: 'zycord_section',
        type: ui.Sa.SECTION,
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
