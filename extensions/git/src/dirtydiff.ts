/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import { Event, TextEditor, window, workspace, Range, TextEditorDecorationType } from 'vscode';
import { IDisposable, dispose } from './util';
import * as parseDiff from 'parse-diff';
import { Git } from './git';

type TextEditorsEvent = Event<TextEditor[]>;

interface IDecorationTypes {
	add: TextEditorDecorationType;
	delete: TextEditorDecorationType;
	modify: TextEditorDecorationType;
}

class ResourceDecorator implements IDisposable {

	private adds: Range[] = [];
	private deletes: Range[] = [];
	private modifys: Range[] = [];
	private textEditors: TextEditor[] = [];

	constructor(private git: Git, private decorationTypes: IDecorationTypes, private workspacePath: string, private path: string) {
		git.exec(workspacePath, ['diff-files', '-U0', '-q', '--', path]).then(result => {
			const patch = parseDiff(result.stdout)[0];

			if (!patch) {
				return;
			}

			patch.chunks.forEach(chunk => {
				const changes = chunk.changes.filter(c => c.del || c.add);
				const deletions = changes.filter(c => c.del).length;
				const additions = changes.filter(c => c.add).length;

				if (additions === 0) {
					this.deletes.push(new Range(chunk.newStart - 1, 0, chunk.newStart, 0));
				} else if (deletions === 0) {
					for (let i = 0; i < additions; i++) {
						this.adds.push(new Range(chunk.newStart - 1 + i, 0, chunk.newStart + i, 0));
					}
				} else {
					for (let i = 0; i < additions; i++) {
						this.modifys.push(new Range(chunk.newStart - 1 + i, 0, chunk.newStart + i, 0));
					}
				}
			});

			this.textEditors.forEach(e => this.decorate(e));
		})
			.catch(err => console.error(err));
	}

	add(textEditor: TextEditor): void {
		this.remove(textEditor);
		this.textEditors.push(textEditor);
		this.decorate(textEditor);
	}

	remove(textEditor: TextEditor): void {
		textEditor.setDecorations(this.decorationTypes.add, []);
		textEditor.setDecorations(this.decorationTypes.delete, []);
		textEditor.setDecorations(this.decorationTypes.modify, []);

		this.textEditors = this.textEditors.filter(e => e !== textEditor);
	}

	get count(): number {
		return this.textEditors.length;
	}

	private decorate(textEditor: TextEditor): void {
		textEditor.setDecorations(this.decorationTypes.add, this.adds);
		textEditor.setDecorations(this.decorationTypes.delete, this.deletes);
		textEditor.setDecorations(this.decorationTypes.modify, this.modifys);
	}

	dispose(): void {
		this.textEditors = [];
	}
}

export class DirtyDiff implements IDisposable {

	private rootPath: string;
	private decorationTypes: IDecorationTypes;
	private textEditors: { editor: TextEditor; path: string; }[] = [];
	private decorators: { [uri: string]: ResourceDecorator } = Object.create(null);
	private disposables: IDisposable[] = [];

	constructor(private git: Git) {
		this.rootPath = path.normalize(workspace.rootPath);

		if (!this.rootPath) {
			return;
		}

		this.decorationTypes = {
			add: window.createTextEditorDecorationType({ color: 'green' }),
			delete: window.createTextEditorDecorationType({ color: 'red' }),
			modify: window.createTextEditorDecorationType({ color: 'blue' })
		};

		window.onDidChangeVisibleTextEditors(this.onDidVisibleEditorsChange, this, this.disposables);
		this.onDidVisibleEditorsChange(window.visibleTextEditors);

		const watcher = workspace.createFileSystemWatcher('**');

		this.disposables.push(watcher);
	}

	private onDidVisibleEditorsChange(textEditors: TextEditor[]): void {
		const relevantTextEditors = textEditors.filter(editor => {
			const uri = editor.document && editor.document.uri;
			const fsPath = uri && path.normalize(uri.fsPath);
			const relativePath = fsPath && path.relative(this.rootPath, fsPath);
			return relativePath && !/^\.\./.test(relativePath);
		});

		const added = relevantTextEditors
			.filter(a => this.textEditors.every(({ editor }) => a !== editor))
			.map(editor => ({ editor, path: workspace.asRelativePath(editor.document.uri) }));

		const removed = this.textEditors
			.filter(({ editor }) => relevantTextEditors.every(b => editor !== b));

		this.textEditors = relevantTextEditors
			.map(editor => ({ editor, path: workspace.asRelativePath(editor.document.uri) }));

		added.forEach(({ editor, path }) => {
			const decorator = this.decorators[path] || (this.decorators[path] = new ResourceDecorator(this.git, this.decorationTypes, this.rootPath, path));
			decorator.add(editor);
		});

		removed.forEach(({ editor, path }) => {
			const decorator = this.decorators[path];
			decorator.remove(editor);

			if (decorator.count === 0) {
				decorator.dispose();
				delete this.decorators[path];
			}
		});
	}

	dispose(): void {
		this.disposables = dispose(this.disposables);
	}
}