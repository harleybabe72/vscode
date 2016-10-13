/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ExtensionContext, workspace } from 'vscode';
import { tmpdir } from 'os';
import { IDisposable, toDisposable, dispose } from './util';
import { findGit, Git } from './git';
import { DirtyDiff } from './dirtydiff';

export function activate(context: ExtensionContext) {
	const disposables: IDisposable[] = [];
	const pathHint = workspace.getConfiguration('git').get<string>('path');

	findGit(pathHint).then(gitInfo => {
		console.log(`Using git ${gitInfo.version}: ${gitInfo.path}`);

		const git = new Git({ gitPath: gitInfo.path, version: gitInfo.version, tmpPath: tmpdir() });
		disposables.push(new DirtyDiff(git));
	});

	context.subscriptions.push(toDisposable(() => dispose(disposables)));
}

export function deactivate() {
}