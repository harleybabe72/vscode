/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import Severity from 'vs/base/common/severity';
import dom = require('vs/base/browser/dom');
import lifecycle = require('vs/base/common/lifecycle');
import {onUnexpectedError} from 'vs/base/common/errors';
import { Action } from 'vs/base/common/actions';
import statusbar = require('vs/workbench/browser/parts/statusbar/statusbar');
import { IExtensionService, IExtensionsStatus } from 'vs/platform/extensions/common/extensions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import {IConfigurationService} from 'vs/platform/configuration/common/configuration';
import { IMessageService, CloseAction } from 'vs/platform/message/common/message';
import { UninstallAction } from 'vs/workbench/parts/extensions/electron-browser/extensionsActions';
import { IQuickOpenService } from 'vs/workbench/services/quickopen/common/quickOpenService';
import { IExtensionsService, IExtension, IExtensionTipsService } from 'vs/workbench/parts/extensions/common/extensions';
import { OcticonLabel } from 'vs/base/browser/ui/octiconLabel/octiconLabel';

var $ = dom.emmet;

export class ExtensionsStatusbarItem implements statusbar.IStatusbarItem {

	private toDispose: lifecycle.IDisposable[];
	private domNode: HTMLElement;
	private status: { [id: string]: IExtensionsStatus };
	private container: HTMLElement;
	private messageCount: number;

	constructor(
		@IExtensionService extensionService: IExtensionService,
		@IMessageService private messageService: IMessageService,
		@IExtensionsService protected extensionsService: IExtensionsService,
		@IInstantiationService protected instantiationService: IInstantiationService

	) {
		this.toDispose = [];
		this.messageCount = 0;

		extensionService.onReady().then(() => {
			this.status = extensionService.getExtensionsStatus();
			Object.keys(this.status).forEach(key => {
				this.messageCount += this.status[key].messages.filter(message => message.type > Severity.Info).length;
			});
			this.render(this.container);
		});
	}

	public render(container: HTMLElement): lifecycle.IDisposable {
		this.container = container;
		if (this.messageCount > 0) {
			this.domNode = dom.append(container, $('a.extensions-statusbar'));
			const issueLabel = this.messageCount > 1 ? nls.localize('issues', "issues") : nls.localize('issue', "issue");
			const extensionLabel = nls.localize('extension', "extension");
			this.domNode.title = `${ this.messageCount } ${ extensionLabel } ${ issueLabel }`;
			this.domNode.textContent = `${ this.messageCount } ${ issueLabel }`;

			this.toDispose.push(dom.addDisposableListener(this.domNode, 'click', () => {
				this.extensionsService.getInstalled().done(installed => {
					Object.keys(this.status).forEach(key => {
						this.status[key].messages.forEach(m => {
							if (m.type > Severity.Info) {
								const extension = installed.filter(ext => ext.path === m.source).pop();
								const actions = [CloseAction];
								const name = (extension && extension.name) || m.source;
								const message = `${ name }: ${ m.message }`;

								if (extension) {
									const actionLabel = nls.localize('uninstall', "Uninstall");
									actions.push(new Action('extensions.uninstall2', actionLabel, null, true, () => this.instantiationService.createInstance(UninstallAction).run(extension)));
								}

								this.messageService.show(m.type, { message, actions });
							}
						});
					});
				}, onUnexpectedError);
			}));
		}

		return lifecycle.combinedDispose(...this.toDispose);
	}
}

export class ExtensionTipsStatusbarItem implements statusbar.IStatusbarItem {

	private domNode: HTMLElement;
	private label: OcticonLabel;
	private toDispose: lifecycle.IDisposable[];

	constructor(
		@IQuickOpenService private quickOpenService: IQuickOpenService,
		@IExtensionTipsService private extensionTipsService: IExtensionTipsService,
		@IConfigurationService private configurationService: IConfigurationService,
		@ITelemetryService private telemetryService: ITelemetryService
	) {
		this.toDispose = [];
		this.update();
	}

	private update(): void {
		this.toDispose = lifecycle.disposeAll(this.toDispose);

		this.configurationService.loadConfiguration('extensions').then(value => {
			if (value && value.showTips === true) {
				this.extensionTipsService.onDidChangeTips(this.onTips, this, this.toDispose);
				this.onTips(this.extensionTipsService.tips);
			} else {
				this.onTips([]);
			}
		}, onUnexpectedError);

		this.configurationService.onDidUpdateConfiguration(this.update, this, this.toDispose);
	}

	private onTips(tips: IExtension[]): void {
		if (!this.domNode) {
			return;
		}

		if (tips.length === 0) {
			dom.addClass(this.domNode, 'disabled');
		} else {
			dom.removeClass(this.domNode, 'disabled');
			this.telemetryService.publicLog('extensionGallery:tips', { hintingTips: true });
		}
	}

	render(container: HTMLElement): lifecycle.IDisposable {
		this.domNode = document.createElement('a');
		this.domNode.className = 'extensions-suggestions disabled';
		this.label = new OcticonLabel(this.domNode);
		this.label.text = '$(light-bulb) extension tips';
		container.appendChild(this.domNode);
		return dom.addDisposableListener(this.domNode, 'click', event => this.onClick(event));
	}

	private onClick(event: MouseEvent): void {
		this.telemetryService.publicLog('extensionGallery:tips', { revealingTips: true });
		this.quickOpenService.show('ext tips ');
	}
}