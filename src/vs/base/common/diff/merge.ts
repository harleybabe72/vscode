/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IDiffChange } from './diff';

export interface IRange {
	readonly start: number;
	readonly length: number;
}

export interface IMergeChange {
	readonly ours: IRange;
	readonly theirs: IRange;
	readonly merged: IRange;
}

export interface IDiffChange2 {
	readonly original: IRange;
	readonly modified: IRange;
}

export function fromDiffChange(diffChange: IDiffChange): IDiffChange2 {
	const original = { start: diffChange.originalStart, length: diffChange.originalLength };
	const modified = { start: diffChange.modifiedStart, length: diffChange.modifiedLength };
	return { original, modified };
}

export function intersect(one: IRange, other: IRange): IRange {
	const oneEnd = one.start + one.length;
	const otherEnd = other.start + other.length;

	if (one.start >= otherEnd || other.start >= oneEnd) {
		return null;
	}

	const start = Math.max(one.start, other.start);
	const end = Math.min(oneEnd, otherEnd);
	const length = end - start;

	return length <= 0 ? null : { start, length };
}

export function createMerge(ours: IDiffChange[], theirs: IDiffChange[]): IMergeChange[] {
	const ours2 = ours.map(fromDiffChange);
	const theirs2 = theirs.map(fromDiffChange);

	const result: IMergeChange[] = [];
	let i = 0, j = 0;

	while (i < ours2.length || j < theirs2.length) {
		const current = result[result.length - 1];
		const ourDiff = ours2[i];
		const theirDiff = theirs2[j];

		const useOurs = !theirDiff || (ourDiff && ourDiff.original.start <= theirDiff.original.start);
		const diff = useOurs ? ourDiff : theirDiff;

		const intersection = current && intersect(current.merged, diff.original);

		if (intersection) {
			// TODO
		} else {
			const ours = useOurs ? ourDiff.modified : theirDiff.original;
			const theirs = useOurs ? ourDiff.original : theirDiff.modified;
			const merged = useOurs ? ourDiff.original : theirDiff.original;
			result.push({ ours, theirs, merged });
		}

		if (useOurs) {
			i++;
		} else {
			j++;
		}
	}

	return result;
}