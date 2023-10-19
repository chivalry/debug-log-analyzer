/*
 * Copyright (c) 2020 Certinia Inc. All rights reserved.
 */
import { type ExtensionContext, workspace } from 'vscode';

import { Display } from './Display';
import { SymbolFinder } from './SymbolFinder';
import { WhatsNewNotification } from './WhatsNewNotification';
import ShowAnalysisCodeLens from './codelenses/ShowAnalysisCodeLens';
import { RetrieveLogFile } from './commands/RetrieveLogFile';
import { ShowLogAnalysis } from './commands/ShowLogAnalysis';
import { VSWorkspace } from './workspace/VSWorkspace';

export class Context {
  symbolFinder = new SymbolFinder();
  context: ExtensionContext;
  display: Display;
  workspaces: VSWorkspace[] = [];

  constructor(context: ExtensionContext, display: Display) {
    this.context = context;
    this.display = display;

    if (workspace.workspaceFolders) {
      this.workspaces = workspace.workspaceFolders.map((folder) => {
        return new VSWorkspace(folder);
      });
    }

    RetrieveLogFile.apply(this);
    ShowLogAnalysis.apply(this);
    ShowAnalysisCodeLens.apply(this);
    WhatsNewNotification.apply(this);
  }

  findSymbol(wsPath: string, symbol: string): string | null {
    const path = this.symbolFinder.findSymbol(wsPath, symbol);
    if (!path) {
      this.display.showErrorMessage(`Type '${symbol}' was not found in workspace`);
    }
    return path;
  }
}
