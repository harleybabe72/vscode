/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { render, Component, Element as PreactElement } from 'preact';

// TSX configuration
declare namespace JSX {
	interface Element extends PreactElement<any> {}
	interface ElementClass extends Component<any, any> {}
	interface ElementAttributesProperty { props; }
}

export * from 'preact';

/**
 * Custom render function which allows for field service injection.
 */
export function render(element: PreactElement<any>, container: HTMLElement, instantiationService: IInstantiationService);
