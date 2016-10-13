/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Event } from 'vscode';
import * as debouncePromise from 'debounce-promise';

export interface IDisposable {
	dispose(): void;
}

export function dispose<T extends IDisposable>(disposables: T[]): T[] {
	disposables.forEach(d => d.dispose());
	return [];
}

export function toDisposable(dispose: () => void): IDisposable {
	return { dispose };
}

export function combinedDisposable(disposables: IDisposable[]): IDisposable {
	return toDisposable(() => dispose(disposables));
}

export function mapEvent<I, O>(event: Event<I>, map: (i: I) => O): Event<O> {
	return (listener, thisArgs = null, disposables?) => event(i => listener.call(thisArgs, map(i)), null, disposables);
}

export function filterEvent<T>(event: Event<T>, filter: (e: T) => boolean): Event<T> {
	return (listener, thisArgs = null, disposables?) => event(e => filter(e) && listener.call(thisArgs, e), null, disposables);
}

export function anyEvent<T>(...events: Event<T>[]): Event<T> {
	return (listener, thisArgs = null, disposables?) => combinedDisposable(events.map(event => event(i => listener.call(thisArgs, i), disposables)));
}

interface IListener<T> {
	(e: T): any;
}

export class Emitter<T> {

	private listeners: IListener<T>[];

	get event(): Event<T> {
		return (listener: IListener<T>, thisArgs = null, disposables?: IDisposable[]) => {
			const _listener = thisArgs ? listener.bind(thisArgs) : listener;
			this.listeners.push(_listener);

			const dispose = () => { this.listeners = this.listeners.filter(l => l !== _listener); };
			const result = { dispose };

			if (disposables) {
				disposables.push(result);
			}

			return result;
		};
	}

	fire(e: T = null): void {

	}
}

export function debounce(wait: number) {
	return (target: any, key: string, descriptor: any) => {
		if (!(typeof descriptor.value === 'function')) {
			throw new Error('not supported');
		}

		const fn = descriptor.value;
		const memoizeKey = `$memoize$${key}`;

		descriptor['value'] = function (...args) {
			if (!this.hasOwnProperty(memoizeKey)) {
				const debouncedFn = debouncePromise(fn.bind(this), wait);

				Object.defineProperty(this, memoizeKey, {
					configurable: false,
					enumerable: false,
					writable: false,
					value: debouncedFn
				});
			}

			return this[memoizeKey].apply(this, args);
		};
	};
}

export function memoize(target: any, key: string, descriptor: any) {
	let fnKey: string = null;
	let fn: Function = null;

	if (typeof descriptor.value === 'function') {
		fnKey = 'value';
		fn = descriptor.value;
	} else if (typeof descriptor.get === 'function') {
		fnKey = 'get';
		fn = descriptor.get;
	}

	if (!fn) {
		throw new Error('not supported');
	}

	const memoizeKey = `$memoize$${key}`;

	descriptor[fnKey] = function (...args) {
		if (!this.hasOwnProperty(memoizeKey)) {
			Object.defineProperty(this, memoizeKey, {
				configurable: false,
				enumerable: false,
				writable: false,
				value: fn.apply(this, args)
			});
		}

		return this[memoizeKey];
	};
}