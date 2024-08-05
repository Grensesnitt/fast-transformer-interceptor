import 'reflect-metadata';

export const NO_CHECK_KEY = 'Grensesnitt/noCheck';

export function NoCheck() {
    return (target: any, propertyKey?: string) => {
        if (propertyKey) {
            // Property decorator
            Reflect.defineMetadata(NO_CHECK_KEY, true, target, propertyKey);
        } else {
            // Class decorator
            Reflect.defineMetadata(NO_CHECK_KEY, true, target);
        }
    };
}