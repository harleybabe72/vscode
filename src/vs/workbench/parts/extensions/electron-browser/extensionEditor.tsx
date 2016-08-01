/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/extensionEditor';
import { localize } from 'vs/nls';
import Event, { Emitter } from 'vs/base/common/event';
import { TPromise } from 'vs/base/common/winjs.base';
import { marked } from 'vs/base/common/marked/marked';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IDisposable, empty, dispose, toDisposable } from 'vs/base/common/lifecycle';
import { Builder } from 'vs/base/browser/builder';
import { append, emmet as $, addClass, removeClass } from 'vs/base/browser/dom';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { IViewlet } from 'vs/workbench/common/viewlet';
import { IViewletService } from 'vs/workbench/services/viewlet/common/viewletService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IRequestService } from 'vs/platform/request/common/request';
import { IExtensionGalleryService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IThemeService } from 'vs/workbench/services/themes/common/themeService';
import { ExtensionsInput } from './extensionsInput';
import { IExtensionsWorkbenchService, IExtensionsViewlet, VIEWLET_ID, IExtension } from './extensions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ITemplateData } from './extensionsList';
import { RatingWidgetX, InstallWidgetX } from './extensionsWidgets';
import { EditorOptions } from 'vs/workbench/common/editor';
import { shell } from 'electron';
import product from 'vs/platform/product';
import { IAction } from 'vs/base/common/actions';
import { ActionBarX } from 'vs/base/browser/ui/actionbar/actionbar';
import { CombinedInstallAction, UpdateAction, EnableAction } from './extensionsActions';
import WebView from 'vs/workbench/parts/html/browser/webview';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { render, Component, Element } from 'jsx';

export interface HeaderProps {
	onExtensionChange: Event<IExtension>;
}

export interface HeaderState {
	extension: IExtension;
}

export class Header extends Component<HeaderProps, HeaderState> {

	@IInstantiationService private instantiationService: IInstantiationService;
	@IViewletService private viewletService: IViewletService;
	@IExtensionsWorkbenchService extensionsWorkbenchService: IExtensionsWorkbenchService;

	private get extension(): IExtension { return this.state.extension; }
	private get extensionUrl(): string { return `${ product.extensionsGallery.itemUrl }?itemName=${ this.extension.publisher }.${ this.extension.name }`; }
	private get extensionLicenseUrl(): string { return `${ product.extensionsGallery.itemUrl }/${ this.extension.publisher }.${ this.extension.name }/license`; }
	private actions: IAction[];
	private disposables: IDisposable[];

	componentDidMount() {
		const installAction = this.instantiationService.createInstance(CombinedInstallAction);
		const updateAction = this.instantiationService.createInstance(UpdateAction);
		const enableAction = this.instantiationService.createInstance(EnableAction);

		const extensionChangeListener = this.props.onExtensionChange(extension => {
			installAction.extension = extension;
			updateAction.extension = extension;
			enableAction.extension = extension;
			this.setState({ extension });
		});

		const extensionsChangeListener = this.extensionsWorkbenchService.onChange(() => {
			this.setState({ extension: this.state.extension });
		});

		this.actions = [installAction, updateAction, enableAction];
		this.disposables = [extensionChangeListener, extensionsChangeListener].concat(this.actions);
	}

	componentWillUnmount() {
		this.disposables = dispose(this.disposables);
	}

	render(): Element<HeaderProps> {
		if (!this.extension) {
			return null;
		}

		return <div class='header'>
			<div class='icon' style={ `background-image: url("${ this.extension.iconUrl }");` } />
			<div class='details'>
				<div class='title'>
					<a class='name' href='#' onclick={ () => this.onTitleClick() }>{ this.extension.displayName }</a>
				</div>
				<div class='subtitle'>
					<a class='publisher' href='#' onclick={ () => this.onPublisherClick() }>{ this.extension.publisherDisplayName }</a>
					<InstallWidgetX extension={ this.extension } />
					<RatingWidgetX extension={ this.extension } onClick={ () => this.onRatingClick() } />
					<a class='license' href='#' onclick={ () => this.onLicenseClick() }>{ localize('license', 'License') }</a>
				</div>
				<div class='description'>{ this.extension.description }</div>
				<div class='actions'>
					<ActionBarX actions={ this.actions } actionOptions={{ icon: true, label: true }} />
				</div>
			</div>
		</div>;
	}

	private onTitleClick(): void {
		if (!this.extension || !product.extensionsGallery) {
			return null;
		}

		shell.openExternal(this.extensionUrl);
	}

	private onPublisherClick(): void {
		if (!this.extension || !product.extensionsGallery) {
			return null;
		}

		this.viewletService.openViewlet(VIEWLET_ID, true)
			.then(viewlet => viewlet as IExtensionsViewlet)
			.done(viewlet => viewlet.search(`publisher:"${ this.extension.publisherDisplayName }"`, true));
	}

	private onRatingClick(): void {
		if (!this.extension || !product.extensionsGallery) {
			return null;
		}

		shell.openExternal(`${ this.extensionUrl }#review-details`);
	}

	private onLicenseClick(): void {
		if (!this.extension || !product.extensionsGallery) {
			return null;
		}

		shell.openExternal(this.extensionLicenseUrl);
	}
}

function renderBody(body: string): string {
	return `<!DOCTYPE html>
		<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<link rel="stylesheet" type="text/css" href="${ require.toUrl('./media/markdown.css') }" >
			</head>
			<body>${ body }</body>
		</html>`;
}

export class ExtensionEditor extends BaseEditor {

	static ID: string = 'workbench.editor.extension';

	private onExtensionChange = new Emitter<IExtension>();

	private body: HTMLElement;

	private _highlight: ITemplateData;
	private highlightDisposable: IDisposable;

	private transientDisposables: IDisposable[];
	private disposables: IDisposable[];

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IExtensionGalleryService private galleryService: IExtensionGalleryService,
		@IConfigurationService private configurationService: IConfigurationService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IRequestService private requestService: IRequestService,
		@IViewletService private viewletService: IViewletService,
		@IExtensionsWorkbenchService private extensionsWorkbenchService: IExtensionsWorkbenchService,
		@IThemeService private themeService: IThemeService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService
	) {
		super(ExtensionEditor.ID, telemetryService);
		this._highlight = null;
		this.highlightDisposable = empty;
		this.disposables = [];

		viewletService.onDidActiveViewletChange(this.onActiveViewletChange, this, this.disposables);
	}

	createEditor(parent: Builder): void {
		const container = parent.getHTMLElement();

		const root = append(container, $('.extension-editor'));
		const header = <Header onExtensionChange={ this.onExtensionChange.event } />;
		render(header, root, this.instantiationService);

		this.body = append(root, $('.body'));
	}

	setInput(input: ExtensionsInput, options: EditorOptions): TPromise<void> {
		this.transientDisposables = dispose(this.transientDisposables);

		const extension = input.extension;

		// const install = this.instantiationService.createInstance(InstallWidget, this.installCount, { extension });
		// this.transientDisposables.push(install);

		// const ratings = this.instantiationService.createInstance(RatingsWidget, this.rating, { extension });
		// this.transientDisposables.push(ratings);

		this.body.innerHTML = '';
		let promise: TPromise<any> = super.setInput(input, options);

		if (extension.readmeUrl) {
			promise = promise
				.then(() => addClass(this.body, 'loading'))
				.then(() => this.requestService.makeRequest({ url: extension.readmeUrl }))
				.then(response => response.responseText)
				.then(marked.parse)
				.then<void>(body => {
					const webview = new WebView(
						this.body,
						document.querySelector('.monaco-editor-background'),
						link => shell.openExternal(link.toString())
					);

					webview.style(this.themeService.getTheme());
					webview.contents = [renderBody(body)];

					const listener = this.themeService.onDidThemeChange(themeId => webview.style(themeId));
					this.transientDisposables.push(webview, listener);
				})
				.then(null, () => null)
				.then(() => removeClass(this.body, 'loading'));
		} else {
			promise = promise
				.then(() => append(this.body, $('p')))
				.then(p => p.textContent = localize('noReadme', "No README available."));
		}

		this.transientDisposables.push(toDisposable(() => promise.cancel()));

		this.onExtensionChange.fire(extension);

		return TPromise.as(null);
	}

	layout(): void {
		return;
	}

	private onActiveViewletChange(viewlet: IViewlet): void {
		if (!viewlet || viewlet.getId() === VIEWLET_ID) {
			return;
		}

		this.editorService.closeEditor(this.position, this.input).done(null, onUnexpectedError);
	}

	dispose(): void {
		this._highlight = null;
		this.transientDisposables = dispose(this.transientDisposables);
		this.disposables = dispose(this.disposables);
		super.dispose();
	}
}
