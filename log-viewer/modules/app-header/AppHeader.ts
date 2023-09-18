/*
 * Copyright (c) 2023 Certinia Inc. All rights reserved.
 */
import {
  provideVSCodeDesignSystem,
  vsCodePanelTab,
  vsCodePanelView,
  vsCodePanels,
} from '@vscode/webview-ui-toolkit';
import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import '../log-levels/LogLevels';
import '../navbar/NavBar';
import { Notification } from '../notifications/NotificationPanel';
import { TruncationColor, TruncationEntry } from '../parsers/TreeParser';
import { RootNode } from '../timeline/Timeline';
import '../timeline/TimelineView';

provideVSCodeDesignSystem().register(vsCodePanelTab(), vsCodePanelView(), vsCodePanels());

@customElement('app-header')
export class AppHeader extends LitElement {
  @property({ type: String })
  logName = 'No Log';
  @property()
  logPath = '';
  @property()
  logSize = null;
  @property()
  logDuration = null;
  @property()
  logStatus = 'Processing...';
  @property()
  notifications: Notification[] = [];
  @property()
  timelineRoot: RootNode | null = null;

  @state()
  _selectedTab = 'timeline-tab';

  constructor() {
    super();
    document.addEventListener('show-tab', (e: Event) => {
      this._showTabEvent(e);
    });

    document.addEventListener('logcontext', (e: Event) => {
      this._updateLogContext(e);
    });
  }

  static styles = css`
    :host {
      background-color: var(--vscode-tab-activeBackground);
      box-shadow: inset 0 calc(max(1px, 0.0625rem) * -1) var(--vscode-panelSectionHeader-background);
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .header {
      background-color: var(--vscode-tab-activeBackground);
      box-shadow: inset 0 calc(max(1px, 0.0625rem) * -1) var(--vscode-panelSectionHeader-background);
    }

    .tab-holder {
      display: flex;
    }
    .tab-holder {
      display: flex;
    }

    .tab {
      display: inline-block;
      box-shadow: inset 0 calc(max(1px, 0.0625rem) * -1) var(--vscode-panelSectionHeader-background);
      background-color: var(--vscode-tab-background);
      color: var(--vscode-tab-inactiveForeground);
      padding: 5px 10px;
      cursor: pointer;
    }
    .tab.tab--selected {
      border-bottom-width: 0;
      box-shadow: inset 0 calc(max(1px, 0.0625rem) * -1) var(--vscode-panelTitle-activeBorder);
      background-color: var(--vscode-tab-activeBackground);
      color: var(--vscode-tab-activeForeground);
      cursor: default;
    }
    .tab--pad {
      flex-grow: 1;
    }
    vscode-panels {
      height: 100%;
    }

    vscode-panel-view {
      height: 100%;
    }
  `;

  render() {
    return html`
      <nav-bar
        .logName=${this.logName}
        .logPath=${this.logPath}
        .logSize=${this.logSize}
        .logDuration=${this.logDuration}
        .logStatus=${this.logStatus}
        .notifications=${this.notifications}
      ></nav-bar>
      <log-levels></log-levels>
      <vscode-panels activeid="${this._selectedTab}">
        <vscode-panel-tab
          id="timeline-tab"
          data-show="timeline-view"
          @click="${this._showTabHTMLElem}"
          >Timeline</vscode-panel-tab
        >
        <vscode-panel-tab id="tree-tab" data-show="call-tree-view" @click="${this._showTabHTMLElem}"
          >Call Tree</vscode-panel-tab
        >
        <vscode-panel-tab
          id="analysis-tab"
          data-show="analysis-view"
          @click="${this._showTabHTMLElem}"
          >Analysis</vscode-panel-tab
        >
        <vscode-panel-tab id="database-tab" data-show="db-view" @click="${this._showTabHTMLElem}"
          >Database</vscode-panel-tab
        >
        <vscode-panel-view id="view1"
          ><timeline-view .timelineRoot="${this.timelineRoot}"></timeline-view
        ></vscode-panel-view>
        <vscode-panel-view id="view2"></vscode-panel-view>
        <vscode-panel-view id="view3"></vscode-panel-view>
        <vscode-panel-view id="view4"></vscode-panel-view>
      </vscode-panels>
    `;
  }

  _showTabHTMLElem(e: Event) {
    const input = e.target as HTMLElement;
    this._showTab(input);
  }

  _showTabEvent(e: Event) {
    const tabId = (e as CustomEvent).detail.tabid;
    const tab = this.renderRoot?.querySelector(`#${tabId}`) as HTMLElement;
    this._showTab(tab);
  }

  _showTab(elem: HTMLElement) {
    if (this._selectedTab !== elem.id) {
      this._selectedTab = elem.id;

      const tabber = document.querySelector('.tabber'),
        show = elem?.dataset.show,
        tabItem = show ? document.getElementById(show) : null;

      // remove selected from all tab items + select new one
      tabber
        ?.querySelectorAll('.tab__item')
        .forEach((t) => t.classList.remove('tab__item--selected'));
      if (tabItem) {
        tabItem.classList.add('tab__item--selected');
      }
    }
  }

  _updateLogContext(e: Event) {
    const logContext = (e as CustomEvent).detail;
    ({
      name: this.logName,
      path: this.logPath,
      size: this.logSize,
      duration: this.logDuration,
    } = logContext);

    if (logContext.status) {
      this.logStatus = logContext.status;
    }

    const truncated = logContext.truncated as TruncationEntry[];
    if (truncated.length) {
      this.notifications = [];
      truncated.forEach((element) => {
        const severity = element.color === TruncationColor.error ? 'Error' : 'Warning';

        const logMessage = new Notification();
        logMessage.message = element.reason;
        logMessage.severity = severity;
        this.notifications.push(logMessage);
      });
    }

    this.timelineRoot = logContext.timelineRoot;
  }
}
