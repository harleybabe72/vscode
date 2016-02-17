/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import { Registry } from 'vs/platform/platform';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import statusbar = require('vs/workbench/browser/parts/statusbar/statusbar');
import { ExtensionsStatusbarItem, ExtensionTipsStatusbarItem } from 'vs/workbench/parts/extensions/electron-browser/extensionsWidgets';
import { IGalleryService } from 'vs/workbench/parts/extensions/common/extensions';
import { GalleryService } from 'vs/workbench/parts/extensions/node/vsoGalleryService';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { ExtensionsWorkbenchExtension } from 'vs/workbench/parts/extensions/electron-browser/extensionsWorkbenchExtension';
import ConfigurationRegistry = require('vs/platform/configuration/common/configurationRegistry');
import { IViewletService } from 'vs/workbench/services/viewlet/common/viewletService';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ViewletRegistry, Extensions as ViewletExtensions, ViewletDescriptor, ToggleViewletAction } from 'vs/workbench/browser/viewlet';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actionRegistry';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';

// Register Gallery Service
registerSingleton(IGalleryService, GalleryService);

// Register Extensions Workbench Extension
(<IWorkbenchContributionsRegistry>Registry.as(WorkbenchExtensions.Workbench)).registerWorkbenchContribution(
	ExtensionsWorkbenchExtension
);

// Register Statusbar item
(<statusbar.IStatusbarRegistry>Registry.as(statusbar.Extensions.Statusbar)).registerStatusbarItem(new statusbar.StatusbarItemDescriptor(
	ExtensionsStatusbarItem,
	statusbar.StatusbarAlignment.LEFT,
	10 /* Low Priority */
));

// Register Statusbar item
(<statusbar.IStatusbarRegistry>Registry.as(statusbar.Extensions.Statusbar)).registerStatusbarItem(new statusbar.StatusbarItemDescriptor(
	ExtensionTipsStatusbarItem,
	statusbar.StatusbarAlignment.LEFT,
	9 /* Low Priority */
));


(<ConfigurationRegistry.IConfigurationRegistry>Registry.as(ConfigurationRegistry.Extensions.Configuration)).registerConfiguration({
	id: 'extensions',
	type: 'object',
	properties: {
		'extensions.showTips': {
			type: 'boolean',
			default: false,
			description: nls.localize('extConfig', "Suggest extensions based on changed and open files."),
		}
	}
});

export var VIEWLET_ID = 'workbench.view.extensions';

class OpenExtensionsViewletAction extends ToggleViewletAction {
	public static ID = VIEWLET_ID;
	public static LABEL = nls.localize('toggleExtensionsViewlet', "Show Extensions");

	constructor(id: string, label: string, @IViewletService viewletService: IViewletService, @IWorkbenchEditorService editorService: IWorkbenchEditorService) {
		super(id, label, VIEWLET_ID, viewletService, editorService);
	}
}

// Register Action to Open Viewlet
(<IWorkbenchActionRegistry> Registry.as(ActionExtensions.WorkbenchActions)).registerWorkbenchAction(
	new SyncActionDescriptor(OpenExtensionsViewletAction, OpenExtensionsViewletAction.ID, OpenExtensionsViewletAction.LABEL),
	nls.localize('view', "View")
);

// Register Viewlet
(<ViewletRegistry>Registry.as(ViewletExtensions.Viewlets)).registerViewlet(new ViewletDescriptor(
	'vs/workbench/parts/extensions/electron-browser/extensionsViewlet',
	'ExtensionsViewlet',
	VIEWLET_ID,
	nls.localize('extensions', "Extensions"),
	'git',
	200
));