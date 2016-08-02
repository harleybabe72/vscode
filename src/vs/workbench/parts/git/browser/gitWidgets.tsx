/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import strings = require('vs/base/common/strings');
import { IAction } from 'vs/base/common/actions';
import { Classes } from 'vs/base/browser/dom';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IGitService, ServiceState, IBranch, ServiceOperations, IRemote } from 'vs/workbench/parts/git/common/git';
import { IStatusbarItem } from 'vs/workbench/browser/parts/statusbar/statusbar';
import { IQuickOpenService } from 'vs/workbench/services/quickopen/common/quickOpenService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { SyncAction, PublishAction } from './gitActions';
import Severity from 'vs/base/common/severity';
import { IMessageService } from 'vs/platform/message/common/message';
import { render, Component, Element } from 'jsx';

interface State {
	serviceState: ServiceState;
	isBusy: boolean;
	isSyncing: boolean;
	HEAD: IBranch;
	remotes: IRemote[];
	ps1: string;
}

class GitStatusbarItemX extends Component<void,State> {

	@IGitService private gitService: IGitService;
	@IQuickOpenService private quickOpenService: IQuickOpenService;
	@IInstantiationService private instantiationService: IInstantiationService;
	@IMessageService private messageService: IMessageService;
	@ITelemetryService private telemetryService: ITelemetryService;

	private syncAction: IAction;
	private publishAction: IAction;
	private disposables: IDisposable[];

	getInitialState(): State {
		return {
			serviceState: ServiceState.NotInitialized,
			isBusy: false,
			isSyncing: false,
			HEAD: null,
			remotes: [],
			ps1: ''
		};
	}

	componentDidMount(): void {
		this.syncAction = this.instantiationService.createInstance(SyncAction, SyncAction.ID, SyncAction.LABEL);
		this.publishAction = this.instantiationService.createInstance(PublishAction, PublishAction.ID, PublishAction.LABEL);

		const gitServiceListener = this.gitService.addBulkListener2(() => {
			const model = this.gitService.getModel();

			this.setState({
				serviceState: this.gitService.getState(),
				isBusy: this.gitService.getRunningOperations().some(op => op.id === ServiceOperations.CHECKOUT || op.id === ServiceOperations.BRANCH),
				isSyncing: this.gitService.getRunningOperations().some(op => op.id === ServiceOperations.SYNC),
				HEAD: model.getHEAD(),
				remotes: model.getRemotes(),
				ps1: model.getPS1()
			});
		});

		this.disposables = [
			this.syncAction,
			this.publishAction,
			gitServiceListener
		];
	}

	componentWillUnmount(): void {
		this.disposables = dispose(this.disposables);
	}

	render(_, state: State): Element<any> {
		if (state.serviceState !== ServiceState.OK) {
			return <div class='git-statusbar-group'>
				<a class='git-statusbar-branch-item disabled' title={ localize('gitNotEnabled', "Git is not enabled in this workspace.") }>{ '\u00a0' }</a>
			</div>;
		}

		const branchClasses = new Classes('git-statusbar-branch-item');
		branchClasses.set(state.isBusy, 'busy');
		branchClasses.set(state.HEAD && !state.HEAD.name, 'headless');

		const isOutOfSync = state.HEAD && state.HEAD.name && state.HEAD.commit && state.HEAD.upstream && (state.HEAD.ahead || state.HEAD.behind);
		let aheadBehind = '';

		if (isOutOfSync) {
			aheadBehind = strings.format('{0}↓ {1}↑', state.HEAD.behind, state.HEAD.ahead);
		}

		let action = null;

		if (state.HEAD && !!state.HEAD.upstream) {
			const classes = new Classes('git-statusbar-sync-item');
			classes.set(this.state.isSyncing, 'syncing');
			classes.set(!isOutOfSync, 'empty');

			console.log(!isOutOfSync, classes.toString());

			action = <a class={ classes.toString() } title={  localize('syncBranch', "Synchronize Changes") } onclick={ () => this.onSyncClick() }>
				<span class='octicon octicon-sync' />
				<span class=' ahead-behind'>{ aheadBehind }</span>
			</a>;

		} else if (state.remotes.length > 0) {
			action = <a class='octicon octicon-cloud-upload' title={ localize('publishBranch', "Publish Branch") } onclick={ () => this.onPublishClick() } />;
		}

		return <div class='git-statusbar-group'>
			<a class={ branchClasses.toString() } onclick={ state.isBusy || (() => this.onBranchClick()) }>{ state.ps1 }</a>
			{ action }
		</div>;
	}

	private onBranchClick(): void {
		this.quickOpenService.show('git checkout ');
	}

	private onPublishClick(): void {
		this.runAction(this.publishAction);
	}

	private onSyncClick(): void {
		this.runAction(this.syncAction);
	}

	private runAction(action: IAction): void {
		if (!action.enabled) {
			return;
		}

		this.telemetryService.publicLog('workbenchActionExecuted', { id: action.id, from: 'status bar' });

		action.run().done(null, err => this.messageService.show(Severity.Error, err));
	}
}

export class GitStatusbarItem implements IStatusbarItem {

	constructor(@IInstantiationService private instantiationService: IInstantiationService) {}

	render(container: HTMLElement): IDisposable {
		render(<GitStatusbarItemX />, container, this.instantiationService);
		return { dispose: () => render(null, container) };
	}
}