/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/git.contribution';
import { ThrottledDelayer } from 'vs/base/common/async';
import * as lifecycle from 'vs/base/common/lifecycle';
import * as winjs from 'vs/base/common/winjs.base';
import * as ext from 'vs/workbench/common/contributions';
import * as common from 'vs/editor/common/editorCommon';
import * as widget from 'vs/editor/browser/codeEditor';
import { IEventService } from 'vs/platform/event/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IMessageService } from 'vs/platform/message/common/message';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IEditorWorkerService } from 'vs/editor/common/services/editorWorkerService';
import URI from 'vs/base/common/uri';
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { IDirtyDiffService } from 'vs/workbench/services/scm/common/dirtydiff';

class DirtyDiffModelDecorator {

	static MODIFIED_DECORATION_OPTIONS: common.IModelDecorationOptions = {
		linesDecorationsClassName: 'git-dirty-modified-diff-glyph',
		isWholeLine: true,
		overviewRuler: {
			color: 'rgba(0, 122, 204, 0.6)',
			darkColor: 'rgba(0, 122, 204, 0.6)',
			position: common.OverviewRulerLane.Left
		}
	};

	static ADDED_DECORATION_OPTIONS: common.IModelDecorationOptions = {
		linesDecorationsClassName: 'git-dirty-added-diff-glyph',
		isWholeLine: true,
		overviewRuler: {
			color: 'rgba(0, 122, 204, 0.6)',
			darkColor: 'rgba(0, 122, 204, 0.6)',
			position: common.OverviewRulerLane.Left
		}
	};

	static DELETED_DECORATION_OPTIONS: common.IModelDecorationOptions = {
		linesDecorationsClassName: 'git-dirty-deleted-diff-glyph',
		isWholeLine: true,
		overviewRuler: {
			color: 'rgba(0, 122, 204, 0.6)',
			darkColor: 'rgba(0, 122, 204, 0.6)',
			position: common.OverviewRulerLane.Left
		}
	};

	private decorations: string[];
	private diffDelayer: ThrottledDelayer<void>;
	private toDispose: lifecycle.IDisposable[];

	constructor(
		private model: common.IModel,
		private uri: URI,
		@IDirtyDiffService private dirtyDiffService: IDirtyDiffService,
		@IModelService private modelService: IModelService,
		@IEditorWorkerService private editorWorkerService: IEditorWorkerService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService
	) {
		this.decorations = [];
		this.diffDelayer = new ThrottledDelayer<void>(200);
		this.toDispose = [];
		this.toDispose.push(model.onDidChangeContent(() => this.triggerDiff()));
	}

	private triggerDiff(): winjs.Promise {
		if (!this.diffDelayer) {
			return winjs.TPromise.as(null);
		}

		return this.dirtyDiffService.getDirtyDiffTextDocument(this.uri).then(originalUri => {
			return this.diffDelayer.trigger(() => {
				if (!this.model || this.model.isDisposed()) {
					return winjs.TPromise.as<any>([]); // disposed
				}

				return this.editorWorkerService.computeDirtyDiff(originalUri, this.model.uri, true);
			}).then((diff: common.IChange[]) => {
				if (!this.model || this.model.isDisposed()) {
					return; // disposed
				}

				return this.decorations = this.model.deltaDecorations(this.decorations, DirtyDiffModelDecorator.changesToDecorations(diff || []));
			});
		});
	}

	private static changesToDecorations(diff: common.IChange[]): common.IModelDeltaDecoration[] {
		return diff.map((change) => {
			const startLineNumber = change.modifiedStartLineNumber;
			const endLineNumber = change.modifiedEndLineNumber || startLineNumber;

			// Added
			if (change.originalEndLineNumber === 0) {
				return {
					range: {
						startLineNumber: startLineNumber, startColumn: 1,
						endLineNumber: endLineNumber, endColumn: 1
					},
					options: DirtyDiffModelDecorator.ADDED_DECORATION_OPTIONS
				};
			}

			// Removed
			if (change.modifiedEndLineNumber === 0) {
				return {
					range: {
						startLineNumber: startLineNumber, startColumn: 1,
						endLineNumber: startLineNumber, endColumn: 1
					},
					options: DirtyDiffModelDecorator.DELETED_DECORATION_OPTIONS
				};
			}

			// Modified
			return {
				range: {
					startLineNumber: startLineNumber, startColumn: 1,
					endLineNumber: endLineNumber, endColumn: 1
				},
				options: DirtyDiffModelDecorator.MODIFIED_DECORATION_OPTIONS
			};
		});
	}

	dispose(): void {
		this.toDispose = lifecycle.dispose(this.toDispose);
		if (this.model && !this.model.isDisposed()) {
			this.model.deltaDecorations(this.decorations, []);
		}
		this.model = null;
		this.decorations = null;
		if (this.diffDelayer) {
			this.diffDelayer.cancel();
			this.diffDelayer = null;
		}
	}
}

export class DirtyDiffDecorator implements ext.IWorkbenchContribution {

	private models: common.IModel[] = [];
	private decorators: { [modelId: string]: DirtyDiffModelDecorator } = Object.create(null);
	private toDispose: lifecycle.IDisposable[] = [];

	constructor(
		@IMessageService private messageService: IMessageService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IEditorGroupService editorGroupService: IEditorGroupService,
		@IEventService private eventService: IEventService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		this.toDispose.push(editorGroupService.onEditorsChanged(() => this.onEditorsChanged()));
	}

	getId(): string {
		return 'git.DirtyDiffModelDecorator';
	}

	private onEditorsChanged(): void {
		// HACK: This is the best current way of figuring out whether to draw these decorations
		// or not. Needs context from the editor, to know whether it is a diff editor, in place editor
		// etc.

		const models = this.editorService.getVisibleEditors()

			// map to the editor controls
			.map(e => e.getControl())

			// only interested in code editor widgets
			.filter(c => c instanceof widget.CodeEditor)

			// map to models
			.map(e => (<widget.CodeEditor>e).getModel())

			// remove nulls and duplicates
			.filter((m, i, a) => !!m && !!m.uri && a.indexOf(m, i + 1) === -1)

			// get the associated resource
			.map(m => ({ model: m, uri: m.uri }));

		const newModels = models.filter(p => this.models.every(m => p.model !== m));
		const oldModels = this.models.filter(m => models.every(p => p.model !== m));

		newModels.forEach(({ model, uri }) => this.onModelVisible(model, uri));
		oldModels.forEach(m => this.onModelInvisible(m));

		this.models = models.map(p => p.model);
	}

	private onModelVisible(model: common.IModel, uri: URI): void {
		this.decorators[model.id] = this.instantiationService.createInstance(DirtyDiffModelDecorator, model, uri);
	}

	private onModelInvisible(model: common.IModel): void {
		this.decorators[model.id].dispose();
		delete this.decorators[model.id];
	}

	dispose(): void {
		this.toDispose = lifecycle.dispose(this.toDispose);
		this.models.forEach(m => this.decorators[m.id].dispose());
		this.models = null;
		this.decorators = null;
	}
}
