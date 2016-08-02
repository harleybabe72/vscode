/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { assign } from 'vs/base/common/objects';

const memoizeSymbol = Symbol('memoize');

export function memoize(target: any, name: string, descriptor: any): any {
	const key = `$$memoize$${ name }`;
	const get = descriptor.get;
	target[key] = memoizeSymbol;

	return assign(Object.create(null), descriptor, {
		get() {
			if (this[key] === memoizeSymbol) {
				this[key] = get.call(this);
			}

			return this[key];
		}
	});
}

export function autobind(target: any, name: string, descriptor: any): any {
	const fn = descriptor.value;

	return {
		configurable: true,
		get() {
			if (this === target.prototype || this.hasOwnProperty(name)) {
				return fn;
			}

			const value = fn.bind(this);
			Object.defineProperty(this, name, { value, configurable: true, writable: true });
			return value;
		}
	};
}