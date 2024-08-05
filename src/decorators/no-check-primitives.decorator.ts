import 'reflect-metadata';

export const NO_CHECK_PRIMITIVES_KEY = 'Grensesnitt/noCheckPrimitives';

export function NoCheckPrimitives() {
    return (target: any) => {
        Reflect.defineMetadata(NO_CHECK_PRIMITIVES_KEY, true, target);
    };
}