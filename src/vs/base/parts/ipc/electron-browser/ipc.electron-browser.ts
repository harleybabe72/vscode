/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { fromEventEmitter } from 'vs/base/node/event';
import { IPCClient } from 'vs/base/parts/ipc/common/ipc';
import { Protocol } from 'vs/base/parts/ipc/common/ipc.electron';
import { ipcRenderer, remote } from 'electron';

export class Client extends IPCClient {

	constructor() {
		super(
			new Protocol(ipcRenderer, fromEventEmitter<string>(ipcRenderer, 'ipc:message', (_, message) => message)),
			String(remote.getCurrentWindow().webContents.id)
		);
	}
}