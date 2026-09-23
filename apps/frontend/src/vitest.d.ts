import '@testing-library/jest-dom/vitest';

declare module 'vitest' {
	interface Assertion<R, T> {
		toBeInTheDocument(this: Assertion<R, T>): R;
		toHaveTextContent(this: Assertion<R, T>, expected: string | RegExp): R;
		toBeDisabled(this: Assertion<R, T>): R;
		toHaveAttribute(this: Assertion<R, T>, name: string, value?: string): R;
	}
}
