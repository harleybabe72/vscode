/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/scmViewlet';
import Event, { Emitter } from 'vs/base/common/event';
import { IDisposable, dispose, empty as EmptyDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IMenuService, MenuId, IMenu } from 'vs/platform/actions/common/actions';
import { IAction } from 'vs/base/common/actions';
import URI from 'vs/base/common/uri';
import { fillInActions } from 'vs/platform/actions/browser/menuItemActionItem';
import { ISCMService, ISCMProvider, ISCMResource, ISCMResourceGroup } from 'vs/workbench/services/scm/common/scm';

// export function fillInActions2(menu: IMenu, context: any, target: IAction[] | { primary: IAction[]; secondary: IAction[]; }, isPrimaryGroup: (group: string) => boolean = group => group === 'navigation'): void {
// 	const groups = menu.getActions(context);
// 	if (groups.length === 0) {
// 		return;
// 	}

// 	for (let tuple of groups) {
// 		let [group, actions] = tuple;
// 		if (isPrimaryGroup(group)) {

// 			const head = Array.isArray<IAction>(target) ? target : target.primary;

// 			// split contributed actions at the point where order
// 			// changes form lt zero to gte
// 			let pivot = 0;
// 			for (; pivot < actions.length; pivot++) {
// 				if ((<MenuItemAction>actions[pivot]).order >= 0) {
// 					break;
// 				}
// 			}
// 			// prepend contributed actions with order lte zero
// 			head.unshift(...actions.slice(0, pivot));

// 			// find the first separator which marks the end of the
// 			// navigation group - might be the whole array length
// 			let sep = 0;
// 			while (sep < head.length) {
// 				if (head[sep] instanceof Separator) {
// 					break;
// 				}
// 				sep++;
// 			}
// 			// append contributed actions with order gt zero
// 			head.splice(sep, 0, ...actions.slice(pivot));

// 		} else {
// 			const to = Array.isArray<IAction>(target) ? target : target.secondary;

// 			if (to.length > 0) {
// 				to.push(new Separator());
// 			}

// 			to.push(...actions);
// 		}
// 	}
// }

export class SCMMenus implements IDisposable {

	private disposables: IDisposable[] = [];

	private activeProviderId: string;
	private providerDisposable: IDisposable = EmptyDisposable;
	private titleActions: IAction[] = [];
	private titleSecondaryActions: IAction[] = [];
	private cache: { [resourceGroupId: string]: { groupMenu: IMenu; resourceMenu: IMenu; contextKeyService: IContextKeyService; }; } = Object.create(null);

	private _onDidChangeTitle = new Emitter<void>();
	get onDidChangeTitle(): Event<void> { return this._onDidChangeTitle.event; }

	constructor(
		@IContextKeyService private contextKeyService: IContextKeyService,
		@ISCMService private scmService: ISCMService,
		@IMenuService private menuService: IMenuService
	) {
		this.setActiveProvider(this.scmService.activeProvider);
		this.scmService.onDidChangeProvider(this.setActiveProvider, this, this.disposables);
	}

	private setActiveProvider(activeProvider: ISCMProvider | undefined): void {
		if (this.providerDisposable) {
			this.providerDisposable.dispose();
			this.providerDisposable = EmptyDisposable;
		}

		if (!activeProvider) {
			return;
		}

		this.activeProviderId = activeProvider.id;

		const titleMenu = this.menuService.createMenu(MenuId.SCMTitle, this.contextKeyService);
		const updateActions = () => {
			this.titleActions = [];
			this.titleSecondaryActions = [];
			fillInActions(titleMenu, null, { primary: this.titleActions, secondary: this.titleSecondaryActions });
			this._onDidChangeTitle.fire();
		};

		const listener = titleMenu.onDidChange(updateActions);
		updateActions();

		this.providerDisposable = toDisposable(() => {
			listener.dispose();
			titleMenu.dispose();
			this.titleActions = [];
			this.titleSecondaryActions = [];

			Object.keys(this.cache).forEach(resourceGroupId => {
				const { groupMenu, resourceMenu, contextKeyService } = this.cache[resourceGroupId];
				groupMenu.dispose();
				resourceMenu.dispose();
				contextKeyService.dispose();
			});

			this.cache = Object.create(null);
		});
	}

	getTitleActions(): IAction[] {
		return this.titleActions;
	}

	getTitleSecondaryActions(): IAction[] {
		return this.titleSecondaryActions;
	}

	getResourceGroupActions(group: ISCMResourceGroup): IAction[] {
		return this.getActions(MenuId.SCMResourceGroupContext, this.getSCMResourceGroupURI(group), group.id, true);
	}

	getResourceGroupContextActions(group: ISCMResourceGroup): IAction[] {
		return this.getActions(MenuId.SCMResourceGroupContext, this.getSCMResourceGroupURI(group), group.id, false);
	}

	getResourceActions(resource: ISCMResource): IAction[] {
		return this.getActions(MenuId.SCMResourceContext, this.getSCMResourceURI(resource), resource.resourceGroupId, true);
	}

	getResourceContextActions(resource: ISCMResource): IAction[] {
		return this.getActions(MenuId.SCMResourceContext, this.getSCMResourceURI(resource), resource.resourceGroupId, false);
	}

	private getSCMResourceGroupURI(resourceGroup: ISCMResourceGroup): URI {
		return URI.from({
			scheme: 'scm',
			authority: this.activeProviderId,
			path: `/${resourceGroup.id}`
		});
	}

	private getSCMResourceURI(resource: ISCMResource): URI {
		return URI.from({
			scheme: 'scm',
			authority: this.activeProviderId,
			path: `/${resource.resourceGroupId}/${JSON.stringify(resource.uri)}`
		});
	}

	private getActions(menuId: MenuId, context: URI, resourceGroupId: string, inline: boolean): IAction[] {
		if (!this.scmService.activeProvider) {
			return [];
		}

		if (!this.cache[resourceGroupId]) {
			const contextKeyService = this.contextKeyService.createScoped();
			contextKeyService.createKey('scmResourceGroup', resourceGroupId);

			this.cache[resourceGroupId] = {
				groupMenu: this.menuService.createMenu(MenuId.SCMResourceGroupContext, contextKeyService),
				resourceMenu: this.menuService.createMenu(MenuId.SCMResourceContext, contextKeyService),
				contextKeyService
			};
		}

		// const cacheRow = this.cache[resourceGroupId];
		// const menu = menuId.id === MenuId.SCMResourceGroupContext.id ? cacheRow.groupMenu : cacheRow.resourceMenu;


		// CONTINUE HERE WITH OWN IMPLEMENTATION OF FILLINACTIONS
		// fillInActions(menu, context, result, g => g === 'inline');

		return [];
	}

	dispose(): void {
		this.disposables = dispose(this.disposables);
	}
}
