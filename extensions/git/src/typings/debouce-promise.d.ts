/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module "debounce-promise" {

	type PromiseFactory<T> = (...args: any[]) => Promise<T>;

	interface Options {
		leading?: boolean;
	}

	function debounce<T>(fn: PromiseFactory<T>, wait?: number, options?: Options): PromiseFactory<T>;

	module debounce { }

	export = debounce;
}