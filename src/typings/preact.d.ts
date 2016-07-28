declare namespace Preact {
	export class Element<P> {
		props: P;
	}

	export class Component<P,S> {
		props: P;
		state: S;
		constructor(props?: P, context?: any);
		setState(state: S, callback?: () => any): void;
		render(props: P, state: S);
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
	function createElement();
}

declare module 'preact' {
	 export = Preact;
}
