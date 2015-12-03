/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import errors = require('vs/base/common/errors');
import { Promise as WinJSPromise, TPromise as WinJSTPromise, ValueCallback, ErrorCallback, ProgressCallback } from 'vs/base/common/winjs.base';
import platform = require('vs/base/common/platform');
import {CancellationTokenSource} from 'vs/base/common/cancellation';

export interface PromiseLike<T> {
	/**
	 * Attaches callbacks for the resolution and/or rejection of the WinJSPromise.
	 * @param onfulfilled The callback to execute when the WinJSPromise is resolved.
	 * @param onrejected The callback to execute when the WinJSPromise is rejected.
	 * @returns A WinJSPromise for the completion of which ever callback is executed.
	*/
	then<TResult>(onfulfilled?: (value: T) => TResult | PromiseLike<TResult>, onrejected?: (reason: any) => TResult | PromiseLike<TResult>): PromiseLike<TResult>;
	then<TResult>(onfulfilled?: (value: T) => TResult | PromiseLike<TResult>, onrejected?: (reason: any) => void): PromiseLike<TResult>;
}

export function wrapAsWinJSPromise<T>(callback: (...args: any[]) => PromiseLike<T>, context: any): (...args: any[]) => WinJSTPromise<T> {

	if (!callback) {
		return;
	}

	let result = function(...args: any[]) {

		let source = new CancellationTokenSource();

		return new WinJSTPromise<T>((c, e) => {

			args.push(source.token);
			let value = callback.apply(context, args);

			if (value && typeof value['then'] === 'function') {
				value.then(c, e);
			} else {
				c(value);
			}

		}, function() {
			source.cancel();
		});
	};

	return result;
}

export interface ITask<T> {
	(): T;
}

/**
 * A helper to prevent accumulation of sequential async tasks.
 *
 * Imagine a mail man with the sole task of delivering letters. As soon as
 * a letter submitted for delivery, he drives to the destination, delivers it
 * and returns to his base. Imagine that during the trip, N more letters were submitted.
 * When the mail man returns, he picks those N letters and delivers them all in a
 * single trip. Even though N+1 submissions occurred, only 2 deliveries were made.
 *
 * The throttler implements this via the queue() method, by providing it a task
 * factory. Following the example:
 *
 * 		var throttler = new Throttler();
 * 		var letters = [];
 *
 * 		function letterReceived(l) {
 * 			letters.push(l);
 * 			throttler.queue(() => { return makeTheTrip(); });
 * 		}
 */
export class Throttler {

	private activePromise: WinJSPromise;
	private queuedPromise: WinJSPromise;
	private queuedPromiseFactory: ITask<WinJSPromise>;

	constructor() {
		this.activePromise = null;
		this.queuedPromise = null;
		this.queuedPromiseFactory = null;
	}

	public queue<T>(promiseFactory: ITask<WinJSTPromise<T>>): WinJSTPromise<T> {
		if (this.activePromise) {
			this.queuedPromiseFactory = promiseFactory;

			if (!this.queuedPromise) {
				var onComplete = () => {
					this.queuedPromise = null;

					var result = this.queue(this.queuedPromiseFactory);
					this.queuedPromiseFactory = null;

					return result;
				};

				this.queuedPromise = new WinJSPromise((c, e, p) => {
					this.activePromise.then(onComplete, onComplete, p).done(c);
				}, () => {
					this.activePromise.cancel();
				});
			}

			return new WinJSPromise((c, e, p) => {
				this.queuedPromise.then(c, e, p);
			}, () => {
				// no-op
			});
		}

		this.activePromise = promiseFactory();

		return new WinJSPromise((c, e, p) => {
			this.activePromise.done((result: any) => {
				this.activePromise = null;
				c(result);
			}, (err: any) => {
				this.activePromise = null;
				e(err);
			}, p);
		}, () => {
			this.activePromise.cancel();
		});
	}
}

/**
 * A helper to delay execution of a task that is being requested often.
 *
 * Following the throttler, now imagine the mail man wants to optimize the number of
 * trips proactively. The trip itself can be long, so the he decides not to make the trip
 * as soon as a letter is submitted. Instead he waits a while, in case more
 * letters are submitted. After said waiting period, if no letters were submitted, he
 * decides to make the trip. Imagine that N more letters were submitted after the first
 * one, all within a short period of time between each other. Even though N+1
 * submissions occurred, only 1 delivery was made.
 *
 * The delayer offers this behavior via the trigger() method, into which both the task
 * to be executed and the waiting period (delay) must be passed in as arguments. Following
 * the example:
 *
 * 		var delayer = new Delayer(WAITING_PERIOD);
 * 		var letters = [];
 *
 * 		function letterReceived(l) {
 * 			letters.push(l);
 * 			delayer.trigger(() => { return makeTheTrip(); });
 * 		}
 */
export class Delayer<T> {

	public defaultDelay: number;
	private timeout: number;
	private completionPromise: WinJSPromise;
	private onSuccess: ValueCallback;
	private task: ITask<T>;

	constructor(defaultDelay: number) {
		this.defaultDelay = defaultDelay;
		this.timeout = null;
		this.completionPromise = null;
		this.onSuccess = null;
		this.task = null;
	}

	public trigger(task: ITask<T>, delay: number = this.defaultDelay): WinJSTPromise<T> {
		this.task = task;
		this.cancelTimeout();

		if (!this.completionPromise) {
			this.completionPromise = new WinJSPromise((c) => {
				this.onSuccess = c;
			}, () => {
				// no-op
			}).then(() => {
				this.completionPromise = null;
				this.onSuccess = null;

				var result = this.task();
				this.task = null;

				return result;
			});
		}

		this.timeout = setTimeout(() => {
			this.timeout = null;
			this.onSuccess(null);
		}, delay);

		return this.completionPromise;
	}

	public isTriggered(): boolean {
		return this.timeout !== null;
	}

	public cancel(): void {
		this.cancelTimeout();

		if (this.completionPromise) {
			this.completionPromise.cancel();
			this.completionPromise = null;
		}
	}

	private cancelTimeout(): void {
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
	}
}

/**
 * A helper to delay execution of a task that is being requested often, while
 * preventing accumulation of consecutive executions, while the task runs.
 *
 * Simply combine the two mail man strategies from the Throttler and Delayer
 * helpers, for an analogy.
 */
export class ThrottledDelayer<T> extends Delayer<WinJSTPromise<T>> {

	private throttler: Throttler;

	constructor(defaultDelay: number) {
		super(defaultDelay);

		this.throttler = new Throttler();
	}

	public trigger(promiseFactory: ITask<WinJSTPromise<T>>, delay?: number): WinJSPromise {
		return super.trigger(() => this.throttler.queue(promiseFactory), delay);
	}
}

/**
 * Similar to the ThrottledDelayer, except it also guarantees that the promise
 * factory doesn't get called more often than every `minimumPeriod` milliseconds.
 */
export class PeriodThrottledDelayer<T> extends ThrottledDelayer<T> {

	private minimumPeriod: number;
	private periodThrottler: Throttler;

	constructor(defaultDelay: number, minimumPeriod: number = 0) {
		super(defaultDelay);

		this.minimumPeriod = minimumPeriod;
		this.periodThrottler = new Throttler();
	}

	public trigger(promiseFactory: ITask<WinJSTPromise<T>>, delay?: number): WinJSPromise {
		return super.trigger(() => {
			return this.periodThrottler.queue(() => {
				return WinJSPromise.join([
					WinJSPromise.timeout(this.minimumPeriod),
					promiseFactory()
				]).then(r => r[1]);
			});
		}, delay);
	}
}

export class PromiseSource<T> {

	private _value: WinJSTPromise<T>;
	private _completeCallback: Function;
	private _errorCallback: Function;

	constructor() {
		this._value = new WinJSTPromise<T>((c, e) => {
			this._completeCallback = c;
			this._errorCallback = e;
		});
	}

	get value(): WinJSTPromise<T> {
		return this._value;
	}

	complete(value?: T): void {
		this._completeCallback(value);
	}

	error(err?: any): void {
		this._errorCallback(err);
	}
}

export class ShallowCancelThenPromise<T> extends WinJSTPromise<T> {

	constructor(outer: WinJSTPromise<T>) {

		var completeCallback: ValueCallback,
			errorCallback: ErrorCallback,
			progressCallback: ProgressCallback;

		super((c, e, p) => {
			completeCallback = c,
			errorCallback = e;
			progressCallback = p;
		}, () => {
			// cancel this promise but not the
			// outer promise
			errorCallback(errors.canceled());
		});

		outer.then(completeCallback, errorCallback, progressCallback);
	}
}

/**
 * Returns a new promise that joins the provided promise. Upon completion of
 * the provided promise the provided function will always be called. This
 * method is comparable to a try-finally code block.
 * @param promise a promise
 * @param f a function that will be call in the success and error case.
 */
export function always<T>(promise: WinJSTPromise<T>, f: Function): WinJSTPromise<T> {
	return new WinJSTPromise<T>((c, e, p) => {
		promise.done((result) => {
			try {
				f(result);
			} catch (e1) {
				errors.onUnexpectedError(e1);
			}
			c(result);
		}, (err) => {
			try {
				f(err);
			} catch (e1) {
				errors.onUnexpectedError(e1);
			}
			e(err);
		}, (progress) => {
			p(progress);
		});
	}, () => {
		promise.cancel();
	});
}

/**
 * Runs the provided list of promise factories in sequential order. The returned
 * promise will complete to an array of results from each promise.
 */
export function sequence<T>(promiseFactory: ITask<WinJSTPromise<T>>[]): WinJSTPromise<T[]> {
	var results: T[] = [];

	// Reverse since we start with last element using pop()
	promiseFactory = promiseFactory.reverse();

	function next(): WinJSPromise {
		if (promiseFactory.length) {
			return promiseFactory.pop()();
		}

		return null;
	}

	function thenHandler(result: any): WinJSPromise {
		if (result) {
			results.push(result);
		}

		var n = next();
		if (n) {
			return n.then(thenHandler);
		}

		return WinJSTPromise.as(results);
	}

	return WinJSPromise.as(null).then(thenHandler);
}

export interface IFunction<A, R> {
	(...args: A[]): R;
}

export function once<A, R>(fn: IFunction<A, R>): IFunction<A, R> {
	var _this = this;
	var didCall = false;
	var result: R;

	return function() {
		if (didCall) {
			return result;
		}

		didCall = true;
		result = fn.apply(_this, arguments);

		return result;
	};
}

interface ILimitedTaskFactory {
	factory: ITask<WinJSPromise>;
	c: ValueCallback;
	e: ErrorCallback;
	p: ProgressCallback;
}

/**
 * A helper to queue N promises and run them all with a max degree of parallelism. The helper
 * ensures that at any time no more than M promises are running at the same time.
 */
export class Limiter<T> {
	private runningPromises: number;
	private maxDegreeOfParalellism: number;
	private outstandingPromises: ILimitedTaskFactory[];

	constructor(maxDegreeOfParalellism: number) {
		this.maxDegreeOfParalellism = maxDegreeOfParalellism;
		this.outstandingPromises = [];
		this.runningPromises = 0;
	}

	public queue(promiseFactory: ITask<WinJSPromise>): WinJSPromise;
	public queue(promiseFactory: ITask<WinJSTPromise<T>>): WinJSTPromise<T> {
		return new WinJSTPromise<T>((c, e, p) => {
			this.outstandingPromises.push({
				factory: promiseFactory,
				c: c,
				e: e,
				p: p
			});

			this.consume();
		});
	}

	private consume(): void {
		while (this.outstandingPromises.length && this.runningPromises < this.maxDegreeOfParalellism) {
			var iLimitedTask = this.outstandingPromises.shift();
			this.runningPromises++;

			var promise = iLimitedTask.factory();
			promise.done(iLimitedTask.c, iLimitedTask.e, iLimitedTask.p);
			promise.done(() => this.consumed(), () => this.consumed());
		}
	}

	private consumed(): void {
		this.runningPromises--;
		this.consume();
	}
}

export class RunOnceScheduler {

	private timeoutToken: platform.TimeoutToken;
	private runner: () => void;
	private timeout: number;
	private timeoutHandler: () => void;

	constructor(runner: () => void, timeout: number) {
		this.timeoutToken = -1;
		this.runner = runner;
		this.timeout = timeout;
		this.timeoutHandler = this.onTimeout.bind(this);
	}

	/**
	 * Dispose RunOnceScheduler
	 */
	public dispose(): void {
		this.cancel();
		this.runner = null;
	}

	/**
	 * Cancel current scheduled runner (if any).
	 */
	public cancel(): void {
		if (this.timeoutToken !== -1) {
			platform.clearTimeout(this.timeoutToken);
			this.timeoutToken = -1;
		}
	}

	/**
	 * Replace runner. If there is a runner already scheduled, the new runner will be called.
	 */
	public setRunner(runner: () => void): void {
		this.runner = runner;
	}

	/**
	 * Set timeout. This change will only impact new schedule calls.
	 */
	public setTimeout(timeout: number): void {
		this.timeout = timeout;
	}

	/**
	 * Cancel previous runner (if any) & schedule a new runner.
	 */
	public schedule(): void {
		this.cancel();
		this.timeoutToken = platform.setTimeout(this.timeoutHandler, this.timeout);
	}

	private onTimeout() {
		this.timeoutToken = -1;
		if (this.runner) {
			this.runner();
		}
	}
}

export function nfcall(fn: Function, ...args: any[]): WinJSPromise;
export function nfcall<T>(fn: Function, ...args: any[]): WinJSTPromise<T>;
export function nfcall(fn: Function, ...args: any[]): any {
	return new WinJSPromise((c, e) => fn(...args, (err, result) => err ? e(err) : c(result)));
}

export function ninvoke(thisArg: any, fn: Function, ...args: any[]): WinJSPromise;
export function ninvoke<T>(thisArg: any, fn: Function, ...args: any[]): WinJSTPromise<T>;
export function ninvoke(thisArg: any, fn: Function, ...args: any[]): any {
	return new WinJSPromise((c, e) => fn.call(thisArg, ...args, (err, result) => err ? e(err) : c(result)));
}

export namespace Convert {

	export function toWinJS<T>(promise: Promise<T>) {
		return new WinJSTPromise<T>((c, e) => promise.then(c, e));
	}

	export function toNative(promise: WinJSPromise);
	export function toNative<T>(promise: WinJSTPromise<T>) {
		return new Promise((c, e) => promise.done(c, e));
	}
}
