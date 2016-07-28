/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*global define,window*/

define(['preact'], preact => {
	const createElement = preact.h;
	window.React = { createElement };

	const _render = preact.render;

	function render(element, container, injectionService) {
		const result = _render(element, container);
		const component = result._component;

		// TODO: inject component

		return result;
	}

	return {
		render,
		Component: preact.Component
	};
});