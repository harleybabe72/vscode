/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const _log = console.log;
console.log = function () {
	const args = Array.prototype.slice.call(arguments) as any[];
	const serializedArgs = args.map(a => JSON.stringify(a));
	chrome.devtools.inspectedWindow.eval('console.log(' + serializedArgs.join(',') + ');');
	return _log.apply(console, arguments);
};
