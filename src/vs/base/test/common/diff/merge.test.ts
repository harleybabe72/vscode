/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { stringDiff } from 'vs/base/common/diff/diff';
import { createMerge } from 'vs/base/common/diff/merge';

suite('createMerge', () => {

	test('empty case', () => {
		assert.deepEqual(createMerge([], []), []);
	});

	test('unilateral cases', () => {
		const oneDeletion = stringDiff('ABCDE', 'ABDE');

		assert.deepEqual(createMerge(oneDeletion, []), [{
			ours: { start: 2, length: 0 },
			merged: { start: 2, length: 1 },
			theirs: { start: 2, length: 1 }
		}], 'one deletion by us');

		assert.deepEqual(createMerge([], oneDeletion), [{
			ours: { start: 2, length: 1 },
			merged: { start: 2, length: 1 },
			theirs: { start: 2, length: 0 }
		}], 'one deletion by them');

		const twoDeletions = stringDiff('ABCDEFGH', 'ABDEGH');

		assert.deepEqual(createMerge(twoDeletions, []), [{
			ours: { start: 2, length: 0 },
			merged: { start: 2, length: 1 },
			theirs: { start: 2, length: 1 }
		}, {
			ours: { start: 4, length: 0 },
			merged: { start: 5, length: 1 },
			theirs: { start: 5, length: 1 }
		}], 'two deletions by us');

		assert.deepEqual(createMerge([], twoDeletions), [{
			ours: { start: 2, length: 1 },
			merged: { start: 2, length: 1 },
			theirs: { start: 2, length: 0 }
		}, {
			ours: { start: 5, length: 1 },
			merged: { start: 5, length: 1 },
			theirs: { start: 4, length: 0 }
		}], 'two deletions by them');

		const oneInsertion = stringDiff('ABDE', 'ABCDE');

		assert.deepEqual(createMerge(oneInsertion, []), [{
			ours: { start: 2, length: 1 },
			merged: { start: 2, length: 0 },
			theirs: { start: 2, length: 0 }
		}], 'one insertion by us');

		assert.deepEqual(createMerge([], oneInsertion), [{
			ours: { start: 2, length: 0 },
			merged: { start: 2, length: 0 },
			theirs: { start: 2, length: 1 }
		}], 'one insertion by them');

		const oneModification = stringDiff('ABCDE', 'ABXDE');

		assert.deepEqual(createMerge(oneModification, []), [{
			ours: { start: 2, length: 1 },
			merged: { start: 2, length: 1 },
			theirs: { start: 2, length: 1 }
		}], 'one modification by us');

		assert.deepEqual(createMerge([], oneModification), [{
			ours: { start: 2, length: 1 },
			merged: { start: 2, length: 1 },
			theirs: { start: 2, length: 1 }
		}], 'one modification by them');

		const allInOne = stringDiff('ABCDEFGH', 'BCXEFZGH');

		assert.deepEqual(createMerge(allInOne, []), [{
			ours: { start: 0, length: 0 },
			merged: { start: 0, length: 1 },
			theirs: { start: 0, length: 1 }
		}, {
			ours: { start: 2, length: 1 },
			merged: { start: 3, length: 1 },
			theirs: { start: 3, length: 1 }
		}, {
			ours: { start: 5, length: 1 },
			merged: { start: 6, length: 0 },
			theirs: { start: 6, length: 0 }
		}], 'all in one by us');

		assert.deepEqual(createMerge([], allInOne), [{
			ours: { start: 0, length: 1 },
			merged: { start: 0, length: 1 },
			theirs: { start: 0, length: 0 }
		}, {
			ours: { start: 3, length: 1 },
			merged: { start: 3, length: 1 },
			theirs: { start: 2, length: 1 }
		}, {
			ours: { start: 6, length: 0 },
			merged: { start: 6, length: 0 },
			theirs: { start: 5, length: 1 }
		}], 'all in one by them');
	});

	test('non-conflicting bilateral cases', () => {
		const deletion = stringDiff('ABCDE', 'ABDE');
		const insertion = stringDiff('ABCDE', 'ABCDEF');

		assert.deepEqual(createMerge(deletion, insertion), [{
			ours: { start: 2, length: 0 },
			merged: { start: 2, length: 1 },
			theirs: { start: 2, length: 1 }
		}, {
			ours: { start: 4, length: 0 },
			merged: { start: 5, length: 0 },
			theirs: { start: 5, length: 1 }
		}], 'deletion by us, insertion by them');

		assert.deepEqual(createMerge(insertion, deletion), [{
			ours: { start: 2, length: 1 },
			merged: { start: 2, length: 1 },
			theirs: { start: 2, length: 0 }
		}, {
			ours: { start: 5, length: 1 },
			merged: { start: 5, length: 0 },
			theirs: { start: 4, length: 0 }
		}], 'insertion by us, deletion by them');
	});
});