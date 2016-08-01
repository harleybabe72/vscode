declare module 'preact' {
	export class Element<P> {
		props: P;
	}

	interface ComponentLifecycle<P, S> {
		componentWillMount?(): void;
		componentDidMount?(): void;
		componentWillUnmount?(): void;
		componentDidUnmount?(): void;
		componentWillReceiveProps?(nextProps: P, nextContext: any): void;
		shouldComponentUpdate?(nextProps: P, nextState: S, nextContext: any): boolean;
		componentWillUpdate?(nextProps: P, nextState: S, nextContext: any): void;
		componentDidUpdate?(prevProps: P, prevState: S, prevContext: any): void;
	}

	export class Component<P,S> implements ComponentLifecycle<P,S> {
		props: P;
		state: S;
		constructor(props?: P, context?: any);
		setState(state: S, callback?: () => any): void;
		render(props: P, state: S);
	}

	export function h(tagName: string, props: any, ...children: Element<any>[]): Element<any>;
	export function render(element: Element<any>, container: HTMLElement);
}

// This is necessary to get TSX working
declare namespace React {
	function createElement();
}