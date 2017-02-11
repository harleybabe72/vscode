/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

interface ExtensionPanel {

}

interface ExtensionPanels {
	create(title: string, iconPath: string, pagePath: string, callback: (panel: ExtensionPanel) => void): void;
}

interface Window {
	eval<T>(expression: string): T;
}

interface Devtools {
	panels: ExtensionPanels;
	inspectedWindow: Window;
}

interface Chrome {
	devtools: Devtools;
}

declare const chrome: Chrome;

const log = console.log;
console.log = function () {
	const args = Array.prototype.slice.call(arguments) as any[];
	const serializedArgs = args.map(a => JSON.stringify(a));
	chrome.devtools.inspectedWindow.eval('console.log(' + serializedArgs.join(',') + ');');
	return log.apply(console, arguments);
};

chrome.devtools.panels.create('VS Code', '', 'panel.html', panel => {
	// console.log(panel);
});