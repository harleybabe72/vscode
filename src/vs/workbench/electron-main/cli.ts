/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'child_process';
import { assign } from 'vs/base/common/objects';
import { parseArgs, helpMessage } from './argv';
import pkg from './package';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IEventService } from 'vs/platform/event/common/event';
import { EventService } from 'vs/platform/event/common/eventService';
import { IRequestService } from 'vs/platform/request/common/request';
import { RequestService } from 'vs/workbench/services/request/node/requestService';
import { ITelemetryService, NullTelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWorkspaceContextService, WorkspaceContextService } from 'vs/workbench/services/workspace/common/contextService';
import { IExtensionsService } from 'vs/workbench/parts/extensions/common/extensions';
import { ExtensionsService } from 'vs/workbench/parts/extensions/node/extensionsService';
// import { GalleryService } from 'vs/workbench/parts/extensions/common/vsoGalleryService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ConfigurationService } from 'vs/workbench/services/configuration/node/configurationService';

function createServices(): IInstantiationService {
	const services = new ServiceCollection();

	const eventService = new EventService();
	const contextService = new WorkspaceContextService(eventService, null, {}, {});
	const configurationService = new ConfigurationService(contextService, eventService);
	const requestService = new RequestService(
		contextService,
		configurationService,
		NullTelemetryService
	);

	services.set(IEventService, eventService);
	services.set(IWorkspaceContextService, contextService);
	services.set(IConfigurationService, configurationService);
	services.set(IRequestService, requestService);
	services.set(ITelemetryService, NullTelemetryService);
	services.set(IExtensionsService, new SyncDescriptor(ExtensionsService));
	// services.set(IGalleryService, new SyncDescriptor(GalleryService));

	return new InstantiationService(services);
}

// TODO move out
function installExtension(id: string): void {
	createServices().invokeFunction(accessor => {
		// const galleryService = accessor.get(IGalleryService);
		const extensionsService = accessor.get(IExtensionsService);

		console.log(extensionsService);
	});
}

// TODO move out
function uninstallExtension(id: string): void {
	const instantiationService = createServices();
	console.log(instantiationService);
}

export function main(args: string[]) {
	const argv = parseArgs(args);

	if (argv.help) {
		console.log(helpMessage);
	} else if (argv.version) {
		console.log(pkg.version);
	} else if (argv['install-extension']) {
		installExtension(argv['install-extension']);
	} else if (argv['uninstall-extension']) {
		uninstallExtension(argv['uninstall-extension']);
	} else {
		const env = assign({}, process.env);
		delete env['ATOM_SHELL_INTERNAL_RUN_AS_NODE'];

		const child = spawn(process.execPath, args, {
			detached: true,
			stdio: 'ignore',
			env
		});

		if (argv.wait) {
			child.on('exit', process.exit);
			return;
		}
	}

	process.exit(0);
}

main(process.argv.slice(2));
