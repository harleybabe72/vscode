declare namespace Preact {
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
		base: HTMLElement;
		constructor(props?: P, context?: any);
		setState(state: S, callback?: () => any): void;
		render(props: P, state: S): Element<P>;
	}

	export function h(tagName: string, props: any, ...children: Element<any>[]): Element<any>;
	export function render(element: Element<any>, container: HTMLElement);
}

declare namespace JSX {
	interface Element extends Preact.Element<any> {}
	interface ElementClass extends Preact.Component<any, any> {}
	interface ElementAttributesProperty { props; }
}

declare namespace React {
	function createElement(tagName: string, props: any, ...children: Preact.Element<any>[]): Preact.Element<any>;
}

declare module 'preact' {
	 export = Preact;
}
