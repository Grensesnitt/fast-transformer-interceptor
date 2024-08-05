import 'reflect-metadata';

export const NO_OUT_KEY = 'Grensesnitt/noOut';

export function NoOut() {
    return (target: any, propertyKey: string) => {
        Reflect.defineMetadata(NO_OUT_KEY, true, target, propertyKey);
    };
}