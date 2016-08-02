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
import { autobind, memoize } from 'vs/base/common/decorators';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
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
import { RatingWidgetX, InstallWidgetX } from './extensionsWidgets';
import { EditorOptions } from 'vs/workbench/common/editor';
import { shell } from 'electron';
import product from 'vs/platform/product';
import { ActionBarX } from 'vs/base/browser/ui/actionbar/actionbar';
import { CombinedInstallAction, UpdateAction, EnableAction } from './extensionsActions';
import WebView from 'vs/workbench/parts/html/browser/webview';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { render, Component, Element } from 'jsx';

function getExtensionUrl(extension: IExtension): string {
	return `${ product.extensionsGallery.itemUrl }?itemName=${ extension.publisher }.${ extension.name }`;
}

function getExtensionLicenseUrl(extension: IExtension): string {
	return `${ product.extensionsGallery.itemUrl }/${ extension.publisher }.${ extension.name }/license`;
}

export interface HeaderServices {
	instantiationService: IInstantiationService;
	viewletService: IViewletService;
}

export interface HeaderProps extends HeaderServices {
	extension: IExtension;
}

export class Header extends Component<HeaderProps, void> {

	@memoize
	private get actions(): (CombinedInstallAction | UpdateAction | EnableAction)[] {
		return [
			this.props.instantiationService.createInstance(CombinedInstallAction),
			this.props.instantiationService.createInstance(UpdateAction),
			this.props.instantiationService.createInstance(EnableAction)
		];
	}

	componentDidMount() {
		this.actions.forEach(a => a.extension = this.props.extension);
	}

	componentWillReceiveProps({ extension }: HeaderProps): void {
		this.actions.forEach(a => a.extension = extension);
	}

	componentWillUnmount() {
		dispose(this.actions);
	}

	render(): Element<HeaderProps> {
		return <div class='header'>
			<div class='icon' style={ `background-image: url("${ this.props.extension.iconUrl }");` } />
			<div class='details'>
				<div class='title'>
					<a class='name' href='#' onclick={ this.onTitleClick }>{ this.props.extension.displayName }</a>
				</div>
				<div class='subtitle'>
					<a class='publisher' href='#' onclick={ this.onPublisherClick }>{ this.props.extension.publisherDisplayName }</a>
					<InstallWidgetX extension={ this.props.extension } />
					<RatingWidgetX extension={ this.props.extension } onClick={ this.onRatingClick } />
					<a class='license' href='#' onclick={ this.onLicenseClick }>{ localize('license', 'License') }</a>
				</div>
				<div class='description'>{ this.props.extension.description }</div>
				<div class='actions'>
					<ActionBarX actions={ this.actions } options={{ animated: false }} actionOptions={{ icon: true, label: true }} />
				</div>
			</div>
		</div>;
	}

	@autobind
	private onTitleClick(): void {
		if (!this.props.extension || !product.extensionsGallery) {
			return null;
		}

		shell.openExternal(getExtensionUrl(this.props.extension));
	}

	@autobind
	private onPublisherClick(): void {
		if (!this.props.extension || !product.extensionsGallery) {
			return null;
		}

		this.props.viewletService.openViewlet(VIEWLET_ID, true)
			.then(viewlet => viewlet as IExtensionsViewlet)
			.done(viewlet => viewlet.search(`publisher:"${ this.props.extension.publisherDisplayName }"`, true));
	}

	@autobind
	private onRatingClick(): void {
		if (!this.props.extension || !product.extensionsGallery) {
			return null;
		}

		shell.openExternal(`${ getExtensionUrl(this.props.extension) }#review-details`);
	}

	@autobind
	private onLicenseClick(): void {
		if (!this.props.extension || !product.extensionsGallery) {
			return null;
		}

		shell.openExternal(getExtensionLicenseUrl(this.props.extension));
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

export interface BodyServices {
	requestService: IRequestService;
	themeService: IThemeService;
}

export interface BodyProps extends BodyServices {
	extension: IExtension;
}

export class Body extends Component<BodyProps, void> {

	private disposables: IDisposable[] = [];

	shouldComponentUpdate() {
		return false;
	}

	componentWillReceiveProps(props: BodyProps) {
		this.load(props.extension);
	}

	componentDidMount() {
		this.load(this.props.extension);
	}

	componentWillUnmount() {
		this.disposables = dispose(this.disposables);
		this.base.innerHTML = '';
	}

	private load(extension: IExtension) {
		this.disposables = dispose(this.disposables);

		this.base.innerHTML = '';
		let promise = TPromise.as(null);

		if (extension.readmeUrl) {
			promise = promise
				.then(() => addClass(this.base, 'loading'))
				.then(() => this.props.requestService.makeRequest({ url: extension.readmeUrl }))
				.then(response => response.responseText)
				.then(marked.parse)
				.then<void>(body => {
					const webview = new WebView(
						this.base,
						document.querySelector('.monaco-editor-background'),
						link => shell.openExternal(link.toString())
					);

					webview.style(this.props.themeService.getTheme());
					webview.contents = [renderBody(body)];

					const listener = this.props.themeService.onDidThemeChange(themeId => webview.style(themeId));
					this.disposables.push(webview, listener);
				})
				.then(null, () => null)
				.then(() => removeClass(this.base, 'loading'));
		} else {
			promise = promise
				.then(() => append(this.base, $('p')))
				.then(p => p.textContent = localize('noReadme', "No README available."));
		}
	}

	render() {
		return <div class='body' />;
	}
}

interface ExtensionEditorServices extends HeaderServices, BodyServices {
	extensionsWorkbenchService: IExtensionsWorkbenchService;
}

interface ExtensionEditorProps extends ExtensionEditorServices {
	onExtensionChange: Event<IExtension>;
}

interface ExtensionEditorState {
	extension: IExtension;
}

class ExtensionEditorX extends Component<ExtensionEditorProps, ExtensionEditorState> {

	private disposables: IDisposable[] = [];

	componentDidMount() {
		this.props.onExtensionChange(extension => this.setState({ extension }), null, this.disposables);
		this.props.extensionsWorkbenchService.onChange(() => this.setState({ extension: this.state.extension }), null, this.disposables);
	}

	componentWillUnmount() {
		this.disposables = dispose(this.disposables);
	}

	render(): JSX.Element {
		if (!this.state.extension) {
			return;
		}

		return <div class='extension-editor'>
			<Header {...this.state} { ...this.props } />
			<Body {...this.state} { ...this.props } />
		</div>;
	}
}

export class ExtensionEditor extends BaseEditor {

	static ID: string = 'workbench.editor.extension';

	private onExtension: Emitter<IExtension>;
	private disposables: IDisposable[];
	private services: ExtensionEditorServices;

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

		this.onExtension = new Emitter<IExtension>();
		this.disposables = [];
		viewletService.onDidActiveViewletChange(this.onActiveViewletChange, this, this.disposables);

		this.services = { instantiationService, viewletService, extensionsWorkbenchService, requestService, themeService };
	}

	createEditor(parent: Builder): void {
		const container = parent.getHTMLElement();
		render(<ExtensionEditorX { ...this.services } onExtensionChange={ this.onExtension.event } />, container);
	}

	setInput(input: ExtensionsInput, options: EditorOptions): TPromise<void> {
		this.onExtension.fire(input.extension);
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
		this.disposables = dispose(this.disposables);
		super.dispose();
	}
}
