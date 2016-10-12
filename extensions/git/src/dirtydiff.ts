/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import { Event, TextEditor, window, workspace } from 'vscode';
import { IDisposable, dispose, anyEvent } from './util';

type TextEditorsEvent = Event<TextEditor[]>;

type IDecoration = void;

class ResourceDecorator implements IDisposable {

	private textEditors: TextEditor[] = [];

	constructor(private path: string) {
	}

	add(textEditor: TextEditor): void {
		this.remove(textEditor);
		this.textEditors.push(textEditor);
	}

	remove(textEditor: TextEditor): void {
		this.textEditors = this.textEditors.filter(e => e !== textEditor);
	}

	get count(): number {
		return this.textEditors.length;
	}

	dispose(): void {
	}
}

export class DirtyDiff implements IDisposable {

	private rootPath: string;
	private textEditors: { editor: TextEditor; path: string; }[] = [];
	private decorators: { [uri: string]: ResourceDecorator } = Object.create(null);
	private disposables: IDisposable[] = [];

	constructor() {
		this.rootPath = path.normalize(workspace.rootPath);

		if (!this.rootPath) {
			return;
		}

		// Unfortunately we must listen on all these events, since
		// there isn't a onDidChangeVisibleTextEditors
		const onVisibleTextEditorsChange = anyEvent<any>(
			window.onDidChangeActiveTextEditor,
			workspace.onDidOpenTextDocument,
			workspace.onDidCloseTextDocument
		);

		onVisibleTextEditorsChange(this.onDidVisibleEditorsChange, this, this.disposables);
		this.onDidVisibleEditorsChange();

		const watcher = workspace.createFileSystemWatcher('**');

		this.disposables.push(watcher);
	}

	private onDidVisibleEditorsChange(): void {
		const textEditors = window.visibleTextEditors.filter(editor => {
			const uri = editor.document && editor.document.uri;
			const fsPath = uri && path.normalize(uri.fsPath);
			const relativePath = fsPath && path.relative(this.rootPath, fsPath);
			return relativePath && !/^\.\./.test(relativePath);
		});

		const added = textEditors
			.filter(a => this.textEditors.every(({ editor }) => a !== editor))
			.map(editor => ({ editor, path: workspace.asRelativePath(editor.document.uri) }));

		const removed = this.textEditors
			.filter(({ editor }) => textEditors.every(b => editor !== b));

		this.textEditors = textEditors
			.map(editor => ({ editor, path: workspace.asRelativePath(editor.document.uri) }));

		added.forEach(({ editor, path }) => {
			const decorator = this.decorators[path] || (this.decorators[path] = new ResourceDecorator(path));
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