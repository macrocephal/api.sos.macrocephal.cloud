export {};

declare global {
    type Token<T> = symbol & Record<never, T>;
}
