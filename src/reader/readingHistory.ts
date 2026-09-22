/**
 * 読書の記録の保存先（vscode 依存）。VS Code の globalState に文書ごとの割合と最後に読んだ時刻を持つ。
 * 記録の更新と並べ替えは reader/reading.ts（単体テスト済み）。
 */
import * as vscode from 'vscode';
import { recentRecords, updateRecord, type ReadingRecord, type ReadingRecords } from './reading';

const KEY = 'yomu.readingHistory';

export class ReadingHistory implements vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  /** 記録が変わった */
  readonly onDidChange: vscode.Event<void> = this.changeEmitter.event;

  constructor(private readonly state: vscode.Memento) {}

  private records(): ReadingRecords {
    return this.state.get<ReadingRecords>(KEY, {});
  }

  get(uri: vscode.Uri): ReadingRecord | undefined {
    return this.records()[uri.toString()];
  }

  recent(): (ReadingRecord & { uri: string })[] {
    return recentRecords(this.records());
  }

  async record(uri: vscode.Uri, title: string, progress: number): Promise<void> {
    await this.state.update(
      KEY,
      updateRecord(this.records(), uri.toString(), title, progress, Date.now())
    );
    this.changeEmitter.fire();
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }
}
