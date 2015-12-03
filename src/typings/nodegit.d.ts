/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'nodegit' {

	export interface IFileStatus {

	}

	export class Repository {
		getStatus(): Promise<IFileStatus[]>;
	}

	export namespace Repository {
		export function open(path: string): Promise<Repository>;
	}

	export interface StatusOptions {
		flags?: number;
		pathspec?: string[];
		show?: number;
		version?: number;
	}

	export class StatusList {
		static create(repo: Repository, opts: StatusOptions): Promise<StatusList>;
		entrycount: number;
		free(): void;
	}
	// export namespace Status {
	// 	export function forEach(repo: Repository, cb: Function, payload: any): Promise<number>;
	// }
}