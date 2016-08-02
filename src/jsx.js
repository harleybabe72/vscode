/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*global define,window*/

define(['preact'], ({ h, render, Component }) => {
	window.React = { createElement: h };
	return { render, Component };
});