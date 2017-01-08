/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Event from 'vs/base/common/event';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { TreeLocation, IFocusChangeEvent, ISelectionChangeEvent } from './tree';

export interface Node<T> {
	readonly element: T;
	readonly children?: Node<T>[];
}

/**
 * TODO:
 *  - tree location > list index
 *  - list index > tree location
 */

export class Tree<T> implements IDisposable {

	private list: List<Node<T>>;
	private disposables: IDisposable[] = [];

	get onFocusChange(): Event<IFocusChangeEvent<T>> {
		throw new Error('not implemented');
	}

	get onSelectionChange(): Event<ISelectionChangeEvent<T>> {
		throw new Error('not implemented');
	}

	constructor(
		container: HTMLElement//,
		// delegate: IDelegate<T>,
		// renderers: IRenderer<T, any>[],
		// options: IListOptions = DefaultOptions
	) {

	}

	get length(): number {
		return this.list.length;
	}

	splice(start: TreeLocation, deleteCount: number, ...nodes: Node<T>[]): void {
		throw new Error('not implemented');
	}

	layout(height?: number): void {
		throw new Error('not implemented');
	}

	setSelection(...locations: TreeLocation[]): void {
		throw new Error('not implemented');
	}

	selectNext(n = 1, loop = false): void {
		throw new Error('not implemented');
	}

	selectPrevious(n = 1, loop = false): void {
		throw new Error('not implemented');
	}

	getSelection(): TreeLocation[] {
		throw new Error('not implemented');
	}

	setFocus(...locations: TreeLocation[]): void {
		throw new Error('not implemented');
	}

	focusNext(n = 1, loop = false): void {
		throw new Error('not implemented');
	}

	focusPrevious(n = 1, loop = false): void {
		throw new Error('not implemented');
	}

	focusNextPage(): void {
		throw new Error('not implemented');
	}

	focusPreviousPage(): void {
		throw new Error('not implemented');
	}

	getFocus(): TreeLocation[] {
		throw new Error('not implemented');
	}

	getFocusedElements(): T[] {
		throw new Error('not implemented');
	}

	dispose(): void {
		this.disposables = dispose(this.disposables);
	}
}