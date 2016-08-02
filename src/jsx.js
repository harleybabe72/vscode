/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*global define,window*/

function isFunctionalComponent(vnode) {
	let nodeName = vnode && vnode.nodeName;
	return nodeName && typeof nodeName === 'function' && !(nodeName.prototype && nodeName.prototype.render);
}

define(['preact'], preact => {
	const createElement = preact.h;
	window.React = { createElement };

	const _render = preact.render;

	function render(vnode, container, instantiationService) {
		if (instantiationService && vnode && !isFunctionalComponent(vnode) && typeof vnode !== 'string' && typeof vnode.nodeName === 'function') {
			const ctor = vnode.nodeName;
			const instantiate = (...args) => {
				const inst = new ctor(...args);

				// TODO@joao should this just be ctor injection?
				instantiationService.inject(inst);
				return inst;
			};

			function Ctor(...args) { return instantiate(...args); }
			Ctor.prototype.render = () => null;
			vnode.nodeName = Ctor;
		}

		return _render(vnode, container);
	}

	return {
		render,
		Component: preact.Component
	};
});