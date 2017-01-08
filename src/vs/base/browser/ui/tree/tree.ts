/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type TreeLocation = number[];

export interface ITreeElement<T> {
	element: T;
	location: TreeLocation;
}

export interface ITreeMouseEvent<T> extends MouseEvent {
	treeElement: ITreeElement<T>;
}

export interface IFocusChangeEvent<T> {
	treeElements: ITreeElement<T>[];
}

export interface ISelectionChangeEvent<T> {
	treeElements: ITreeElement<T>[];
}