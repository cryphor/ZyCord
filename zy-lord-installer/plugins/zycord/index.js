(function () {
  'use strict';

  const ZYCORD_API = 'http://127.0.0.1:47653';
  const DEFAULT_REPO_URL = 'https://github.com/cryphor/ZyLord';
  const SECTION_CLASS = 'section_409aa';
  const CREATOR_UID = '1200586798871621763';
  const BADGE_ID = 'zycord_creator_badge';

  const STYLES = `
    .${SECTION_CLASS}.zycord-panel {
      padding: 60px 40px 80px;
      max-width: 740px;
    }
    .zycord-header {
      margin-bottom: 24px;
    }
    .zycord-muted {
      color: var(--text-muted);
      margin-top: 4px;
    }
    .zycord-block {
      margin-bottom: 28px;
    }
    .zycord-block-title {
      margin-bottom: 12px;
    }
    .zycord-card {
      background: var(--background-secondary);
      border: 1px solid var(--border-faint);
      border-radius: 8px;
      padding: 16px 18px;
    }
    .zycord-card-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 8px 0;
    }
    .zycord-card-row + .zycord-card-row {
      border-top: 1px solid var(--border-faint);
    }
    .zycord-card-label {
      color: var(--header-secondary);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }
    .zycord-card-value {
      color: var(--text-normal);
      font-size: 14px;
      text-align: right;
      word-break: break-word;
    }
    .zycord-card-value code {
      font-family: var(--font-code);
      font-size: 13px;
      background: var(--background-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .zycord-link {
      color: var(--text-link);
      cursor: pointer;
      text-decoration: none;
    }
    .zycord-link:hover {
      text-decoration: underline;
    }
    .zycord-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-normal);
    }
    .zycord-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .zycord-status-dot.ok { background: #3ba55c; }
    .zycord-status-dot.warn { background: #faa81a; }
    .zycord-status-dot.err { background: #ed4245; }
    .zycord-status-dot.load {
      background: var(--text-muted);
      animation: zycord-pulse 1.2s ease-in-out infinite;
    }
    @keyframes zycord-pulse {
      0%, 100% { opacity: 0.35; }
      50% { opacity: 1; }
    }
    .zycord-update-item {
      margin-top: 12px;
      padding: 12px 14px;
      background: var(--background-tertiary);
      border-radius: 6px;
      border-left: 3px solid #faa81a;
      font-size: 14px;
      line-height: 1.45;
      color: var(--text-normal);
    }
    .zycord-update-item code {
      font-family: var(--font-code);
      font-size: 13px;
    }
    .zycord-update-meta {
      margin-top: 6px;
      color: var(--text-muted);
      font-size: 13px;
    }
    .zycord-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
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
    const Toasts = findByProps('show', 'Type', 'Position') || null;
    const React = window.Vencord.Webpack.Common.React;

    return {
      Sa,
      Button,
      FormTitle: Forms.FormTitle,
      FormText: Forms.FormText,
      FormDivider: Forms.FormDivider,
      Margins,
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

  function SidebarHexIcon({ size = 20 }) {
    const { r } = getWebpackUi();
    return r('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      'aria-hidden': true
    },
      r('path', {
        d: 'M12 2 2 7v10l10 5 10-5V7L12 2zm0 2.2 7.5 3.75V16.3L12 20.05 4.5 16.3V7.95L12 4.2z'
      })
    );
  }

  function registerBadge() {
    const badges = window.Vencord?.Api?.Badges;
    if (!badges?.addProfileBadge || window.__ZYCORD_BADGE_REGISTERED__) {
      return;
    }

    window.__ZYCORD_BADGE_REGISTERED__ = true;
    const { addProfileBadge, BadgePosition } = badges;
    const { r, React } = getWebpackUi();

    function ZycordProfileBadge() {
      const gradientId = React.useId
        ? `zycord-badge-${React.useId().replace(/:/g, '')}`
        : `zycord-badge-${Math.random().toString(36).slice(2)}`;

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
    const { Button, FormTitle, FormText, FormDivider, Margins, Toasts, React, r } = ui;
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

    function ExternalLink({ href, children }) {
      return r('a', {
        className: 'zycord-link',
        href,
        onClick: (e) => {
          e.preventDefault();
          openExternal(href);
        }
      }, children);
    }

    function PanelShell({ title, description, children }) {
      return r('div', { className: `${SECTION_CLASS} zycord-panel` },
        r('div', { className: 'zycord-header' },
          FormTitle && r(FormTitle, { tag: 'h1' }, title),
          description && FormText && r(FormText, { className: 'zycord-muted' }, description)
        ),
        children
      );
    }

    function SectionBlock({ title, children }) {
      return r('div', { className: 'zycord-block' },
        title && FormTitle && r(FormTitle, { tag: 'h5', className: 'zycord-block-title' }, title),
        children
      );
    }

    function InfoCard({ rows }) {
      return r('div', { className: 'zycord-card' },
        ...rows.map(({ label, value }, index) =>
          r('div', { key: index, className: 'zycord-card-row' },
            r('span', { className: 'zycord-card-label' }, label),
            r('span', { className: 'zycord-card-value' }, value)
          )
        )
      );
    }

    function StatusLine({ state, text }) {
      return r('div', { className: 'zycord-status' },
        r('span', { className: `zycord-status-dot ${state}` }),
        text
      );
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

    function iconPath(d) {
      return (props) => r('svg', { ...props, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
        r('path', { d })
      );
    }

    const SourceCodeIcon = iconPath('M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z');
    const BuildIcon = iconPath('M22.7 19.3 12 2 1.3 19.3h21.4zM12 18l-5.5-9h11L12 18z');
    const InstallIcon = iconPath('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z');
    const UninstallIcon = iconPath('M19 13H5v-2h14v2z');
    const RestartIcon = iconPath('M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z');
    const PluginsIcon = iconPath('M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z');
    const UpdatesIcon = RestartIcon;
    const ZycordIcon = SidebarHexIcon;

    function ActionButton({ children, disabled, onClick, look }) {
      if (!Button) {
        return r('button', { disabled, onClick, className: 'zycord-link' }, children);
      }
      return r(Button, {
        size: Button.Sizes?.SMALL,
        look: look === 'secondary' ? Button.Looks?.LINK : Button.Looks?.FILLED,
        color: look === 'secondary' ? Button.Colors?.PRIMARY : Button.Colors?.BRAND,
        disabled,
        onClick
      }, children);
    }

    function PluginsPanel() {
      const { busy, run } = useSilentCommand();

      return r(PanelShell, {
        title: 'Plugins',
        description: 'Manage installed plugins.'
      },
        r(SectionBlock, { title: 'Quick Actions' },
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

      return r(PanelShell, {
        title: 'ZyCord',
        description: 'Core install and runtime controls.'
      },
        r(SectionBlock, { title: 'Quick Actions' },
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
      if (!hash) return '—';
      const href = `${repo || DEFAULT_REPO_URL}/commit/${fullHash || hash}`;
      return r(ExternalLink, { href }, r('code', null, hash));
    }

    function UpdatesPanel() {
      const [info, setInfo] = useState(null);
      const [checking, setChecking] = useState(true);
      const [pulling, setPulling] = useState(false);
      const [error, setError] = useState(null);
      const { run } = useSilentCommand();

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
          setInfo(null);
        } finally {
          setChecking(false);
        }
      }

      async function pullUpdate() {
        setPulling(true);
        try {
          await runCommand('pull');
          showToast('Update installed. Relaunch Discord to apply.', 'success');
          await check();
        } catch (err) {
          showToast(String(err.message || err), 'failure');
        } finally {
          setPulling(false);
        }
      }

      useEffect(() => {
        check();
      }, []);

      const repo = info?.repo || DEFAULT_REPO_URL;
      const repoSlug = info?.repoSlug || 'cryphor/ZyLord';
      const hasUpdate = info?.upToDate === false;
      const busy = checking || pulling;

      let statusState = 'load';
      let statusText = 'Checking for updates...';

      if (!checking && error) {
        statusState = 'err';
        statusText = 'Could not check for updates';
      } else if (!checking && info?.upToDate === true) {
        statusState = 'ok';
        statusText = 'Up to Date!';
      } else if (!checking && hasUpdate) {
        statusState = 'warn';
        statusText = 'Update available';
      } else if (!checking && info && info.upToDate == null && !error) {
        statusState = 'warn';
        statusText = 'Installed version recorded';
      }

      return r(PanelShell, {
        title: 'Updates',
        description: 'Version info and release status.'
      },
        r(SectionBlock, { title: 'Repository' },
          r(InfoCard, {
            rows: [
              {
                label: 'Repo',
                value: r(ExternalLink, { href: repo }, repoSlug)
              },
              {
                label: 'Version',
                value: info?.version ? `v${info.version}` : (checking ? '...' : '—')
              },
              {
                label: 'Installed',
                value: checking
                  ? '...'
                  : (info?.commit
                    ? r(CommitLink, { hash: info.commit, fullHash: info.commitFull, repo })
                    : '—')
              }
            ]
          })
        ),
        FormDivider && r(FormDivider, { className: Margins.marginBottom20 }),
        r(SectionBlock, { title: 'Status' },
          r('div', { className: 'zycord-card' },
            r(StatusLine, { state: statusState, text: statusText }),
            error && r('div', { className: 'zycord-update-meta' }, error),
            hasUpdate && r('div', { className: 'zycord-update-item' },
              r(CommitLink, {
                hash: info.remoteCommit,
                fullHash: info.remoteCommitFull,
                repo
              }),
              info.message && r('div', null, info.message),
              info.author && r('div', { className: 'zycord-update-meta' }, info.author)
            )
          ),
          r('div', { className: 'zycord-actions' },
            r(ActionButton, { disabled: busy, onClick: check }, checking ? 'Checking...' : 'Check for Updates'),
            hasUpdate && r(ActionButton, {
              disabled: busy,
              onClick: pullUpdate,
              look: 'secondary'
            }, pulling ? 'Updating...' : 'Update Now')
          )
        )
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
