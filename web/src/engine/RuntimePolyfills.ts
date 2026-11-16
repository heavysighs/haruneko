// Polyfills for JavaScript features that are missing in older runtimes
// (e.g. NW.js 0.79 with Chromium 116, as used by the Mojave build of the desktop client).
// Each polyfill is only installed when the runtime does not provide the feature natively,
// following the same guarded pattern as the other shims in this directory.

if (typeof Array.fromAsync !== 'function') {
    Object.defineProperty(Array, 'fromAsync', {
        value: async function <T, U>(items: AsyncIterable<T> | Iterable<T | PromiseLike<T>> | ArrayLike<T>, mapFn?: (value: Awaited<T>, index: number) => U | PromiseLike<U>, thisArg?: unknown): Promise<Awaited<U>[]> {
            const result: Awaited<U>[] = [];
            let index = 0;
            const collect = async (value: T): Promise<void> => {
                const awaited = await value;
                result.push((mapFn ? await mapFn.call(thisArg, awaited, index) : awaited) as Awaited<U>);
                index++;
            };
            const iterable = items as AsyncIterable<T> | Iterable<T | PromiseLike<T>>;
            if (items != null && (Symbol.asyncIterator in Object(items) || Symbol.iterator in Object(items))) {
                for await (const value of iterable) {
                    await collect(value as T);
                }
            } else if (items != null) {
                const arrayLike = items as ArrayLike<T>;
                const length = Math.max(0, Math.min(Math.trunc(Number(arrayLike.length) || 0), Number.MAX_SAFE_INTEGER));
                while (index < length) {
                    await collect(arrayLike[index]);
                }
            }
            return result;
        },
        writable: true,
        configurable: true,
        enumerable: false,
    });
}

if (typeof Object.groupBy !== 'function') {
    Object.defineProperty(Object, 'groupBy', {
        value: function <T, K extends PropertyKey>(items: Iterable<T>, callbackFn: (value: T, index: number) => K): Record<K, T[]> {
            const result = Object.create(null) as Record<K, T[]>;
            let index = 0;
            for (const item of items) {
                const key = callbackFn(item, index++);
                (result[key] ??= []).push(item);
            }
            return result;
        },
        writable: true,
        configurable: true,
        enumerable: false,
    });
}

if (typeof Map.groupBy !== 'function') {
    Object.defineProperty(Map, 'groupBy', {
        value: function <T, K>(items: Iterable<T>, callbackFn: (value: T, index: number) => K): Map<K, T[]> {
            const result = new Map<K, T[]>();
            let index = 0;
            for (const item of items) {
                const key = callbackFn(item, index++);
                const group = result.get(key);
                if (group) {
                    group.push(item);
                } else {
                    result.set(key, [item]);
                }
            }
            return result;
        },
        writable: true,
        configurable: true,
        enumerable: false,
    });
}

// Dummy export to satisfy requirements of being a module
export {};
