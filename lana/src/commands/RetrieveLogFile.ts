/*
 * Copyright (c) 2020 Certinia Inc. All rights reserved.
 */
import { LogRecord } from '@salesforce/apex-node';
import * as fs from 'fs';
import * as path from 'path';
import { WebviewPanel, window } from 'vscode';

import { appName } from '../AppSettings';
import { Context } from '../Context';
import { Item, Options, QuickPick } from '../display/QuickPick';
import { QuickPickWorkspace } from '../display/QuickPickWorkspace';
import { GetLogFile } from '../sfdx/logs/GetLogFile';
import { GetLogFiles } from '../sfdx/logs/GetLogFiles';
import { Command } from './Command';
import { LogView } from './LogView';

class DebugLogItem extends Item {
  logId: string;

  constructor(
    name: string,
    desc: string,
    details: string,
    logId: string,
    sticky = true,
    selected = false
  ) {
    super(name, desc, details, sticky, selected);
    this.logId = logId;
  }
}

export class RetrieveLogFile {
  static apply(context: Context): void {
    new Command('retrieveLogFile', 'Log: Retrieve Apex Log And Show Analysis', () =>
      RetrieveLogFile.safeCommand(context)
    ).register(context);
    context.display.output(`Registered command '${appName}: Retrieve Log'`);
  }

  private static async safeCommand(context: Context): Promise<WebviewPanel | void> {
    try {
      return RetrieveLogFile.command(context);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      context.display.showErrorMessage(`Error loading logfile: ${msg}`);
      return Promise.resolve();
    }
  }

  private static async command(context: Context): Promise<WebviewPanel | void> {
    const ws = await QuickPickWorkspace.pickOrReturn(context);
    const [logFiles] = await Promise.all([
      GetLogFiles.apply(ws),
      RetrieveLogFile.showLoadingPicker(),
    ]);

    const logFileId = await RetrieveLogFile.getLogFile(logFiles);
    if (logFileId) {
      const logFilePath = this.getLogFilePath(ws, logFileId);
      const [view] = await Promise.all([
        LogView.createView(ws, context, logFilePath),
        this.writeLogFile(ws, logFilePath),
      ]);
      LogView.appendView(view, context, logFileId, logFilePath);
    }
  }

  private static async showLoadingPicker(): Promise<QuickPick> {
    const qp = window.createQuickPick();
    qp.placeholder = 'Select a logfile';
    qp.busy = true;
    qp.enabled = false;
    qp.show();
    return qp;
  }

  private static async getLogFile(files: LogRecord[]): Promise<string | null> {
    const items = files
      .sort((a, b) => {
        const aDate = Date.parse(a.StartTime);
        const bDate = Date.parse(b.StartTime);
        return bDate - aDate;
      })
      .map((r) => {
        const name = `${r.LogUser.Name} - ${r.Operation}`;
        const description = `${(r.LogLength / 1024).toFixed(2)} KB ${r.DurationMilliseconds} ms`;
        const detail = `${new Date(r.StartTime).toLocaleString()} - ${r.Status} - ${r.Id}`;
        return new DebugLogItem(name, description, detail, r.Id);
      });

    const picked = await QuickPick.pick(items, new Options('Select a logfile'));
    if (picked.length === 1) {
      return picked[0].logId;
    }
    return null;
  }

  private static getLogFilePath(ws: string, fileId: string): string {
    const logDirectory = path.join(ws, '.sfdx', 'tools', 'debug', 'logs');
    const logFilePath = path.join(logDirectory, `${fileId}.log`);
    return logFilePath;
  }

  private static async writeLogFile(ws: string, logPath: string) {
    const logExists = fs.existsSync(logPath);
    if (!logExists) {
      const logfilePath = path.parse(logPath);
      await GetLogFile.apply(ws, logfilePath.dir, logfilePath.name);
    }
  }
}
