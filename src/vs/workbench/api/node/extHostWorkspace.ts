/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import URI from 'vs/base/common/uri';
import { relative, isEqualOrParent } from 'vs/base/common/paths';
import { IThreadService } from 'vs/workbench/services/thread/common/threadService';
import { IResourceEdit } from 'vs/editor/common/services/bulkEdit';
import { TPromise } from 'vs/base/common/winjs.base';
import { fromRange } from 'vs/workbench/api/node/extHostTypeConverters';
import { Disposable } from 'vs/workbench/api/node/extHostTypes';
import { MainContext, MainThreadWorkspaceShape, ExtHostWorkspaceShape } from './extHost.protocol';
import { asWinJsPromise } from 'vs/base/common/async';
import * as vscode from 'vscode';

export class ExtHostWorkspace extends ExtHostWorkspaceShape {

	private static _requestIdPool = 0;
	private static _handlePool = 0;

	private _dirtyDiffTextDocumentProviders: { [id: number]: vscode.DirtyDiffTextDocumentProvider; };

	private _proxy: MainThreadWorkspaceShape;
	private _workspacePath: string;

	constructor(threadService: IThreadService, workspacePath: string) {
		super();
		this._proxy = threadService.get(MainContext.MainThreadWorkspace);
		this._workspacePath = workspacePath;
		this._dirtyDiffTextDocumentProviders = Object.create(null);
	}

	getPath(): string {
		return this._workspacePath;
	}

	getRelativePath(pathOrUri: string | vscode.Uri): string {

		let path: string;
		if (typeof pathOrUri === 'string') {
			path = pathOrUri;
		} else {
			path = pathOrUri.fsPath;
		}

		if (isEqualOrParent(path, this._workspacePath)) {
			return relative(this._workspacePath, path) || path;
		}

		return path;
	}

	findFiles(include: string, exclude: string, maxResults?: number, token?: vscode.CancellationToken): Thenable<vscode.Uri[]> {
		const requestId = ExtHostWorkspace._requestIdPool++;
		const result = this._proxy.$startSearch(include, exclude, maxResults, requestId);
		if (token) {
			token.onCancellationRequested(() => this._proxy.$cancelSearch(requestId));
		}
		return result;
	}

	saveAll(includeUntitled?: boolean): Thenable<boolean> {
		return this._proxy.$saveAll(includeUntitled);
	}

	appyEdit(edit: vscode.WorkspaceEdit): TPromise<boolean> {

		let resourceEdits: IResourceEdit[] = [];

		let entries = edit.entries();
		for (let entry of entries) {
			let [uri, edits] = entry;

			for (let edit of edits) {
				resourceEdits.push({
					resource: <URI>uri,
					newText: edit.newText,
					range: fromRange(edit.range)
				});
			}
		}

		return this._proxy.$applyWorkspaceEdit(resourceEdits);
	}

	registerDirtyDiffTextDocumentProvider(provider: vscode.DirtyDiffTextDocumentProvider): vscode.Disposable {
		const handle = ExtHostWorkspace._handlePool++;

		this._dirtyDiffTextDocumentProviders[handle] = provider;
		this._proxy.$registerDirtyDiffTextDocumentProvider(handle);

		return new Disposable(() => {
			if (delete this._dirtyDiffTextDocumentProviders[handle]) {
				this._proxy.$unregisterDirtyDiffTextDocumentProvider(handle);
			}
		});
	}

	$getDirtyDiffTextDocument(id: number, uri: URI): TPromise<URI> {
		const provider = this._dirtyDiffTextDocumentProviders[id];

		if (!provider) {
			return TPromise.wrapError(`invalid dirty diff text document provider`);
		}

		return asWinJsPromise(token => provider.getDirtyDiffTextDocument(uri, token));
	}
}
