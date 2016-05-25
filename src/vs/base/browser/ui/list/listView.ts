/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { toObject, assign } from 'vs/base/common/objects';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { Gesture } from 'vs/base/browser/touch';
import * as DOM from 'vs/base/browser/dom';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/browser/ui/scrollbar/scrollableElementOptions';
import { RangeMap, IRange, relativeComplement, each } from './rangeMap';
import { IDelegate, IRenderer } from './list';
import { RowCache, IRow } from './rowCache';
import { LcsDiff, ISequence } from 'vs/base/common/diff/diff';

interface IItemRange<T> {
	item: IItem<T>;
	index: number;
	range: IRange;
}

interface IItem<T> {
	id: string;
	element: T;
	size: number;
	templateId: string;
	row: IRow;
}

function toSequence<T>(itemRanges: IItemRange<T>[]): ISequence {
	return {
		getLength: () => itemRanges.length,
		getElementHash: i => `${ itemRanges[i].item.id }:${ itemRanges[i].range.start }:${ itemRanges[i].range.end }`
	};
}

const MouseEventTypes = [
	'click',
	'dblclick',
	'mouseup',
	'mousedown',
	'mouseover',
	'mousemove',
	'mouseout',
	'contextmenu'
];

		const str = r => {
			let result = '';
			each(r, i => result += ` ${ i }`);
			return result;
		};

export class ListView<T> implements IDisposable {

	private items: IItem<T>[];
	private itemId: number;
	private rangeMap: RangeMap;
	private cache: RowCache<T>;
	private renderers: { [templateId: string]: IRenderer<T, any>; };
	private lastRenderTop: number;
	private lastRenderHeight: number;
	private _domNode: HTMLElement;
	private gesture: Gesture;
	private rowsContainer: HTMLElement;
	private scrollableElement: ScrollableElement;
	private toDispose: IDisposable[];

	constructor(
		container: HTMLElement,
		private delegate: IDelegate<T>,
		renderers: IRenderer<T, any>[]
	) {
		this.items = [];
		this.itemId = 0;
		this.rangeMap = new RangeMap();
		this.renderers = toObject<IRenderer<T, any>, IRenderer<T, any>>(renderers, r => r.templateId);
		this.cache = new RowCache(this.renderers);

		this.lastRenderTop = 0;
		this.lastRenderHeight = 0;

		this._domNode = document.createElement('div');
		this._domNode.className = 'monaco-list';
		this._domNode.tabIndex = 0;

		this.rowsContainer = document.createElement('div');
		this.rowsContainer.className = 'monaco-list-rows';
		this.gesture = new Gesture(this.rowsContainer);

		this.scrollableElement = new ScrollableElement(this.rowsContainer, {
			canUseTranslate3d: false,
			horizontal: ScrollbarVisibility.Hidden,
			vertical: ScrollbarVisibility.Auto,
			useShadows: false,
			saveLastScrollTimeOnClassName: 'monaco-list-row'
		});

		const listener = this.scrollableElement.onScroll(e => this.render(e.scrollTop, e.height));

		this._domNode.appendChild(this.scrollableElement.getDomNode());
		container.appendChild(this._domNode);

		this.toDispose = [this.rangeMap, this.gesture, listener, this.scrollableElement];

		this.layout();

		// const i = setInterval(() => {
		// 	const ranges = this.getRenderedItemRanges();
		// 	console.log(ranges.length, this.rowsContainer.children.length);
		// }, 1000);

		// this.toDispose.push({ dispose: () => clearInterval(i) });
	}

	get domNode(): HTMLElement {
		return this._domNode;
	}

	splice(start: number, deleteCount: number, ...elements: T[]): T[] {
		// console.log('splice', start, deleteCount, elements.length);


		const details = i => ({ label: i.item.element.suggestion.label, top: this.elementTop(i.index) ,height: i.item.size });
		const before = this.getRenderedItemRanges();
		const beforeDetails = before.map(details);
		const beforeTop = this.getScrollTop();
		const beforeHeight = this.renderHeight;

		const inserted = elements.map<IItem<T>>(element => ({
			id: String(this.itemId++),
			element,
			size: this.delegate.getHeight(element),
			templateId: this.delegate.getTemplateId(element),
			row: null
		}));

		this.rangeMap.splice(start, deleteCount, ...inserted);
		const deleted = this.items.splice(start, deleteCount, ...inserted);

		const after = this.getRenderedItemRanges();
		const afterDetails = after.map(details);
		const afterTop = this.getScrollTop();
		const afterHeight = this.renderHeight;

		// (<any>console).table(afterDetails);

		// const lcs = new LcsDiff(toSequence(before), toSequence(after), null);
		// const diffs = lcs.ComputeDiff();

		// for (const diff of diffs) {
		// 	for (let i = 0; i < diff.originalLength; i++) {
		// 		this.removeItemFromDOM(before[diff.originalStart + i].item);
		// 	}

		// 	for (let i = 0; i < diff.modifiedLength; i++) {
		// 		this.insertItemInDOM(after[diff.modifiedStart + i].item, after[0].index + diff.modifiedStart + i);
		// 	}
		// }

		before.forEach(i => this.removeItemFromDOM(i.item));
		after.forEach(i => this.insertItemInDOM(i.item, i.index));

			// (<any>console).table(beforeDetails);
			// (<any>console).table(afterDetails);
			// console.log(beforeTop, beforeHeight)

		// if (after.length !== this.rowsContainer.children.length) {
		// 	(<any>console).table(beforeDetails);
		// 	(<any>console).table(afterDetails);

		// 	console.log('height diff', beforeHeight, afterHeight);
		// 	console.log('render top', beforeTop, afterTop);
		// 	console.log('render height', this.renderHeight);

		// 	debugger;
		// }

		const scrollHeight = this.getContentHeight();
		this.rowsContainer.style.height = `${ scrollHeight }px`;
		this.scrollableElement.updateState({ scrollHeight });

		return deleted.map(i => i.element);
	}

	get length(): number {
		return this.items.length;
	}

	get renderHeight(): number {
		return this.scrollableElement.getHeight();
	}

	element(index: number): T {
		return this.items[index].element;
	}

	elementHeight(index: number): number {
		return this.items[index].size;
	}

	elementTop(index: number): number {
		return this.rangeMap.positionAt(index);
	}

	indexAt(position: number): number {
		return this.rangeMap.indexAt(position);
	}

	indexAfter(position: number): number {
		return this.rangeMap.indexAfter(position);
	}

	layout(height?: number): void {
		this.scrollableElement.updateState({
			height: height || DOM.getContentHeight(this._domNode)
		});
	}

	// Render

	private render(renderTop: number, renderHeight: number): void {
		console.log('render');
		const renderBottom = renderTop + renderHeight;
		const thisRenderBottom = this.lastRenderTop + this.lastRenderHeight;
		// let i: number, stop: number;

		const previousRange = {
			start: this.rangeMap.indexAt(this.lastRenderTop),
			end: this.rangeMap.indexAt(thisRenderBottom - 1) + 1
		};

		const range = {
			start: this.rangeMap.indexAt(renderTop),
			end: this.rangeMap.indexAt(renderBottom - 1) + 1
		};

		const toInsert = relativeComplement(range, previousRange);
		const toRemove = relativeComplement(previousRange, range);


		const strInsert = str(toInsert);
		const strRemove = str(toRemove);

		// if (strInsert) { console.log('insert', strInsert); }
		// if (strRemove) { console.log('remove', strRemove); }

		each(toInsert, i => {
			const item = this.items[i];

			if (!item) {
				console.log('before debugger');
				debugger;
				console.log('after debugger');
			}

			this.insertItemInDOM(item, i);
		});
		each(toRemove, i => this.removeItemFromDOM(this.items[i]));

		// if (range.end - range.start !== this.rowsContainer.children.length) {
		// 	debugger;
		// }

		// // when view scrolls down, start rendering from the renderBottom
		// for (i = this.rangeMap.indexAfter(renderBottom) - 1, stop = this.rangeMap.indexAt(Math.max(thisRenderBottom, renderTop)); i >= stop; i--) {
		// 	this.insertItemInDOM(this.items[i], i);
		// }

		// // when view scrolls up, start rendering from either this.renderTop or renderBottom
		// for (i = Math.min(this.rangeMap.indexAt(this.lastRenderTop), this.rangeMap.indexAfter(renderBottom)) - 1, stop = this.rangeMap.indexAt(renderTop); i >= stop; i--) {
		// 	this.insertItemInDOM(this.items[i], i);
		// }

		// // when view scrolls down, start unrendering from renderTop
		// for (i = this.rangeMap.indexAt(this.lastRenderTop), stop = Math.min(this.rangeMap.indexAt(renderTop), this.rangeMap.indexAt(thisRenderBottom - 1)); i < stop; i++) {
		// 	this.removeItemFromDOM(this.items[i]);
		// }

		// // when view scrolls up, start unrendering from either renderBottom this.renderTop
		// for (i = Math.max(this.rangeMap.indexAfter(renderBottom - 1), this.rangeMap.indexAt(this.lastRenderTop)), stop = this.rangeMap.indexAfter(thisRenderBottom - 1); i < stop; i++) {
		// 	console.log(renderBottom, this.lastRenderTop);
		// 	console.log('removing', (<any>this.items[i].element).suggestion.label);
		// 	this.removeItemFromDOM(this.items[i]);
		// }

		this.rowsContainer.style.transform = `translate3d(0px, -${ renderTop }px, 0px)`;
		this.lastRenderTop = renderTop;
		this.lastRenderHeight = renderBottom - renderTop;
	}

	private getRenderedItemRanges(): IItemRange<T>[] {
		const result: IItemRange<T>[] = [];
		const renderBottom = this.lastRenderTop + this.lastRenderHeight;

		let start = this.lastRenderTop;
		let index = this.rangeMap.indexAt(start);
		let item = this.items[index];
		let end = -1;

		start = this.rangeMap.positionAt(index);

		while (item && start < renderBottom) {
			end = start + item.size;
			result.push({ item, index, range: { start, end }});
			start = end;
			item = this.items[++index];
		}

		return result;
	}

	// DOM operations

	private insertItemInDOM(item: IItem<T>, index: number): void {
		if (!item.row) {
			item.row = this.cache.alloc(item.templateId);
		}

		if (!item.row.domNode.parentElement) {
			this.rowsContainer.appendChild(item.row.domNode);
		}

		const renderer = this.renderers[item.templateId];
		item.row.domNode.style.top = `${ this.elementTop(index) }px`;
		item.row.domNode.style.height = `${ item.size }px`;
		item.row.domNode.setAttribute('data-index', `${index}`);
		renderer.renderElement(item.element, index, item.row.templateData);
	}

	private removeItemFromDOM(item: IItem<T>): void {
		this.cache.release(item.row);
		item.row = null;
	}

	getContentHeight(): number {
		return this.rangeMap.size;
	}

	getScrollTop(): number {
		return this.scrollableElement.getScrollTop();
	}

	setScrollTop(scrollTop: number): void {
		this.scrollableElement.updateState({ scrollTop });
	}

	// Events

	addListener(type: string, handler: (event:any)=>void, useCapture?: boolean): IDisposable {
		if (MouseEventTypes.indexOf(type) > -1) {
			const userHandler = handler;
			handler = (event: MouseEvent) => {
				const index = this.getItemIndex(event);

				if (index < 0) {
					return;
				}

				const element = this.items[index].element;
				userHandler(assign(event, { element, index }));
			};
		}

		return DOM.addDisposableListener(this.domNode, type, handler, useCapture);
	}

	private getItemIndex(event: MouseEvent): number {
		let target = event.target;

		while (target instanceof HTMLElement && target !== this.rowsContainer) {
			const element = target as HTMLElement;
			const rawIndex = element.getAttribute('data-index');

			if (rawIndex) {
				const index = Number(rawIndex);

				if (!isNaN(index)) {
					return index;
				}
			}

			target = element.parentElement;
		}

		return -1;
	}

	// Dispose

	dispose() {
		this.items = null;

		if (this._domNode && this._domNode.parentElement) {
			this._domNode.parentNode.removeChild(this._domNode);
			this._domNode = null;
		}

		this.toDispose = dispose(this.toDispose);
	}
}
