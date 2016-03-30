/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/extensionsViewlet';
import nls = require('vs/nls');
import { TPromise } from 'vs/base/common/winjs.base';
import { assign } from 'vs/base/common/objects';
import Event, { Emitter } from 'vs/base/common/event';
import { IDisposable, disposeAll } from 'vs/base/common/lifecycle';
import { Builder } from 'vs/base/browser/builder';
import { emmet as $, append } from 'vs/base/browser/dom';
import { Viewlet } from 'vs/workbench/browser/viewlet';
import { Dimension } from 'vs/base/browser/builder';
import { ViewletId } from './extensions.contribution';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IRenderer, IDelegate } from 'vs/base/browser/ui/list/list';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { IExtension, IExtensionsService } from '../common/extensions';
import { IHighlight } from 'vs/base/browser/ui/highlightedlabel/highlightedLabel';
import { SplitView, View, CollapsibleView } from 'vs/base/browser/ui/splitview/splitview';
import { matchesContiguousSubString } from 'vs/base/common/filters';

interface ITemplateData {
	root: HTMLElement;
	// displayName: HighlightedLabel;
	// version: HTMLElement;
	// installCount: HTMLElement;
	// author: HTMLElement;
	// actionbar: ActionBar;
	// description: HighlightedLabel;
	// disposables: IDisposable[];
}

interface IHighlights {
	name: IHighlight[];
	displayName: IHighlight[];
	description: IHighlight[];
}

enum ExtensionState {
	Uninstalled,
	Installed,
	Outdated
}

interface IExtensionEntry {
	extension: IExtension;
	highlights: IHighlights;
	state: ExtensionState;
}

// function extensionEquals(one: IExtension, other: IExtension): boolean {
// 	return one.publisher === other.publisher && one.name === other.name;
// }

function getHighlights(input: string, extension: IExtension): IHighlights {
	const name = matchesContiguousSubString(input, extension.name) || [];
	const displayName = matchesContiguousSubString(input, extension.displayName) || [];
	const description = matchesContiguousSubString(input, extension.description) || [];

	if (!name.length && !displayName.length && !description.length) {
		return null;
	}

	return { name, displayName, description };
}

function extensionEntryCompare(one: IExtensionEntry, other: IExtensionEntry): number {
	const oneInstallCount = one.extension.galleryInformation ? one.extension.galleryInformation.installCount : 0;
	const otherInstallCount = other.extension.galleryInformation ? other.extension.galleryInformation.installCount : 0;
	const diff = otherInstallCount - oneInstallCount;

	if (diff !== 0) {
		return diff;
	}

	return one.extension.displayName.localeCompare(other.extension.displayName);
}

class Delegate implements IDelegate<IExtension> {
	getHeight() { return 24; }
	getTemplateId() { return 'extension'; }
}

class Renderer implements IRenderer<IExtensionEntry, ITemplateData> {

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService,
		@IExtensionsService private extensionsService: IExtensionsService
	) {}

	get templateId() { return 'extension'; }

	renderTemplate(container: HTMLElement): ITemplateData {
		// Important to preserve order here.
		const root = append(container, $('.extension'));
		// const firstRow = append(root, $('.row'));
		// const secondRow = append(root, $('.row'));
		// const published = append(firstRow, $('.published'));
		// const displayName = new HighlightedLabel(append(firstRow, $('span.name')));
		// const installCount = append(firstRow, $('span.installCount'));
		// const version = append(published, $('span.version'));
		// const author = append(published, $('span.author'));

		return {
			root
			// author,
			// displayName,
			// version,
			// installCount,
			// actionbar: new ActionBar(append(secondRow, $('.actions'))),
			// description: new HighlightedLabel(append(secondRow, $('span.description'))),
			// disposables: []
		};
	}

	renderElement(entry: IExtensionEntry, index: number, data: ITemplateData): void {
		const extension = entry.extension;

		data.root.textContent = extension.displayName;

		// const publisher = extension.galleryInformation ? extension.galleryInformation.publisherDisplayName : extension.publisher;
		// const installCount = extension.galleryInformation ? extension.galleryInformation.installCount : null;
		// const actionOptions = { icon: true, label: false };

		// const updateActions = () => {
		// 	// data.actionbar.clear();

		// 	if (entry.extension.galleryInformation) {
		// 		// data.actionbar.push(this.instantiationService.createInstance(OpenInGalleryAction, entry.state !== ExtensionState.Installed), { label: true, icon: false });
		// 	}

		// 	switch (entry.state) {
		// 		case ExtensionState.Uninstalled:
		// 			if (entry.extension.galleryInformation) {
		// 				// data.actionbar.push(this.instantiationService.createInstance(InstallAction, InstallLabel), actionOptions);
		// 			}
		// 			break;
		// 		case ExtensionState.Installed:
		// 			// data.actionbar.push(this.instantiationService.createInstance(UninstallAction), actionOptions);
		// 			break;
		// 		case ExtensionState.Outdated:
		// 			// data.actionbar.push(this.instantiationService.createInstance(UninstallAction), actionOptions);
		// 			// data.actionbar.push(this.instantiationService.createInstance(InstallAction, UpdateLabel), actionOptions);
		// 			break;
		// 	}
		// };

		// const onExtensionStateChange = (e: IExtension, state: ExtensionState) => {
		// 	if (extensionEquals(e, extension)) {
		// 		entry.state = state;
		// 		updateActions();
		// 	}
		// };

		// data.actionbar.context = extension;
		// updateActions();

		// data.disposables = disposeAll(data.disposables);
		// data.disposables.push(this.extensionsService.onDidInstallExtension(e => onExtensionStateChange(e.extension, ExtensionState.Installed)));
		// data.disposables.push(this.extensionsService.onDidUninstallExtension(e => onExtensionStateChange(e, ExtensionState.Uninstalled)));

		// data.displayName.set(extension.displayName, entry.highlights.displayName);
		// data.displayName.element.title = extension.name;
		// data.version.textContent = extension.version;

		// if (isNumber(installCount)) {
		// 	data.installCount.textContent = String(installCount);
		// 	addClass(data.installCount, 'octicon');
		// 	addClass(data.installCount, 'octicon-cloud-download');

		// 	if (!installCount) {
		// 		data.installCount.title = nls.localize('installCountZero', "{0} wasn't downloaded yet.", extension.displayName);
		// 	} else if (installCount === 1) {
		// 		data.installCount.title = nls.localize('installCountOne', "{0} was downloaded once.", extension.displayName);
		// 	} else {
		// 		data.installCount.title = nls.localize('installCountMultiple', "{0} was downloaded {1} times.", extension.displayName, installCount);
		// 	}
		// } else {
		// 	data.installCount.textContent = '';
		// 	removeClass(data.installCount, 'octicon');
		// 	removeClass(data.installCount, 'octicon-cloud-download');
		// }

		// data.author.textContent = publisher;
		// data.description.set(extension.description, entry.highlights.description);
		// data.description.element.title = extension.description;
	}

	disposeTemplate(data: ITemplateData): void {
		// data.displayName.dispose();
		// data.description.dispose();
		// data.disposables = disposeAll(data.disposables);
	}
}

interface IState {
	selectedEntry: IExtensionEntry;
}

type StateUpdater = (state: any) => void;

class ExtensionsView extends View {

	private list: List<IExtensionEntry>;
	private disposables: IDisposable[];

	constructor(
		private updateState: StateUpdater,
		@IExtensionsService private extensionsService: IExtensionsService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super();
		this.disposables = [];
	}

	render(container: HTMLElement): void {
		this.list = new List(container, new Delegate(), [this.instantiationService.createInstance(Renderer)]);
		this.disposables.push(this.list);

		this.extensionsService.getInstalled().done(extensions => {
			const entries = extensions
				.map(extension => ({ extension, highlights: getHighlights('', extension) }))
				.filter(({ highlights }) => !!highlights)
				.map(({ extension, highlights }) => ({
					extension,
					highlights,
					state: ExtensionState.Installed
				}))
				.sort(extensionEntryCompare);

			this.list.splice(0, this.list.length, ...entries);
		});

		this.list.onSelectionChange(event => this.updateState({ selectedEntry: event.elements[0] }));
	}

	focus(): void {
		// TODO
	}

	layout(height: number): void {
		this.list.layout(height);
	}

	dispose(): void {
		this.disposables = disposeAll(this.disposables);
		super.dispose();
	}
}

class DetailsView extends CollapsibleView {

	constructor(private onStateChange: Event<IState>) {
		super({ minimumSize: 24 * 10 });
	}

	renderHeader(container: HTMLElement): void {
		container.textContent = nls.localize('extensionDetails', 'Extension Details');
	}

	renderBody(container: HTMLElement): void {
		container.textContent = 'none';
		this.onStateChange(e => e.selectedEntry && (container.textContent = e.selectedEntry.extension.displayName));
	}

	protected layoutBody(size: number): void {
		// to optionally implement
	}
}

export class ExtensionsViewlet extends Viewlet {

	private state: IState;
	private onStateChangeEmitter: Emitter<IState>;
	private splitview: SplitView;
	private disposables: IDisposable[];

	constructor(
		@IExtensionsService private extensionsService: IExtensionsService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@ITelemetryService telemetryService: ITelemetryService
	) {
		super(ViewletId, telemetryService);
		this.state = { selectedEntry: null };
		this.onStateChangeEmitter = new Emitter();
		this.disposables = [this.onStateChangeEmitter];
	}

	create(parent: Builder): TPromise<void> {
		const domNode = append(parent.getHTMLElement(), $('.extensions-viewlet'));

		this.splitview = new SplitView(domNode);
		this.disposables.push(this.splitview);

		const extensionsView = this.instantiationService.createInstance(ExtensionsView, state => this.updateState(state));
		this.splitview.addView(extensionsView, 2);

		const detailsView = new DetailsView(this.onStateChangeEmitter.event);
		this.splitview.addView(detailsView, 1);

		return TPromise.as(null);
	}

	layout(dimension: Dimension): void {
		this.splitview.layout(dimension.height);
	}

	private updateState(obj: any): void {
		this.state = assign(this.state, obj);
		this.onStateChangeEmitter.fire(this.state);
	}

	dispose(): void {
		this.disposables = disposeAll(this.disposables);
		super.dispose();
	}
}