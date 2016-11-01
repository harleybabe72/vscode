/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Event, { chain, mapEvent } from 'vs/base/common/event';
import { fromEventEmitter } from 'vs/base/node/event';
import { IPCServer, ClientConnectionEvent } from 'vs/base/parts/ipc/common/ipc';
import { Protocol } from 'vs/base/parts/ipc/common/ipc.electron';
import { ipcMain, app } from 'electron';

interface IIPCEvent {
	event: any;
	message: string;
}

export class Server extends IPCServer {

	private static createScopedEvent(eventName: string, senderId: string): Event<any> {
		return chain(fromEventEmitter<IIPCEvent>(ipcMain, eventName, (event, message) => ({ event, message })))
			.filter(({ event }) => event.sender.getId() === senderId)
			.map(({ message }) => message)
			.event;
	}

	private static getOnDidClientConnect(): Event<ClientConnectionEvent> {
		const onWebContentsCreated = fromEventEmitter<Electron.BrowserWindow>(app, 'browser-window-created', (e, window: Electron.BrowserWindow) => window);

		return mapEvent(onWebContentsCreated, window => {
			const webContents = window.webContents;
			const id = String(webContents.id);
			console.log('NEW WINDOW', window.id, webContents.id, webContents.getId());

			const onMessage = Server.createScopedEvent('ipc:message', id);
			const protocol = new Protocol(webContents, onMessage);
			const onDidClientDisconnect = fromEventEmitter<void>(webContents, 'destroyed');

			return { protocol, onDidClientDisconnect };
		});
	}

	constructor() {
		super(Server.getOnDidClientConnect());
	}
}
