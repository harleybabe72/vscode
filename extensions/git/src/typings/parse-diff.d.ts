/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module "parse-diff" {
	interface Change {
		del: boolean;
		add: boolean;
	}

	interface Chunk {
		changes: Change[];
		newStart: number;
	}

	interface Patch {
		chunks: Chunk[];
	}

	function parse(raw: string): Patch[];

	module parse { }

	export = parse;
}