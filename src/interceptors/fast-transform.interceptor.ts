import {
    BadRequestException,
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor
} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {catchError, Observable, throwError} from 'rxjs';
import {map} from 'rxjs/operators';
import 'reflect-metadata';
import {NO_CHECK_KEY} from "../decorators/no-check.decorator";
import {NO_OUT_KEY} from "../decorators/no-out.decorator";
import {NO_CHECK_PRIMITIVES_KEY} from "../decorators/no-check-primitives.decorator";
import {RESPONSE_TYPE_KEY, ResponseTypeOptions} from "../decorators/response-type.decorator";

// Define a generic constructor type
type Constructor<T = any> = new (...args: any[]) => T;

const dtoCache = new Map<string, Record<string, any>>();

class TransformError extends Error {
    constructor(
        message: string,
        public dtoName: string,
        public fieldName: string,
        public receivedValue?: any,
        public expectedType?: string,
        public expectedValues?: any[],
        public fullObject?: any,
        public filter?: Record<string, any>
    ) {
        super(message);
        this.name = 'TransformError';
    }
}

interface FastTransformInterceptorOptions {
    reflector: Reflector;
    debug?: boolean;
    defaultResponse?: any;
    defaultResponseKey?: string;
    defaultDataKey?: string | null;
}

@Injectable()
export class FastTransformInterceptor implements NestInterceptor {
    private readonly reflector: Reflector;
    private readonly debug: boolean;
    private readonly defaultResponse: any;
    private readonly defaultResponseKey: string;
    private readonly defaultDataKey: string;

    constructor(options: FastTransformInterceptorOptions) {
        this.reflector = options.reflector;
        this.debug = options.debug ?? false;
        this.defaultResponse = options.defaultResponse ?? null;
        this.defaultResponseKey = options.defaultResponseKey ?? "data";
        this.defaultDataKey = options.defaultDataKey ?? null;
    }

    dataToResponse(data: any, response: any, responseKey: string) {
        if (!response) {
            return data;
        }
        const result = { ...response };
        result[responseKey] = data;
        return result;
    }

    getDataObject(data: any, dataKey: string | null) {
        return !dataKey ? data : data[dataKey];
    }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const handler = context.getHandler();
        const classContext = context.getClass();
        const responseTypeMetadata = this.reflector.getAllAndOverride<ResponseTypeOptions>(
            RESPONSE_TYPE_KEY,
            [handler, classContext]
        );

        if (!responseTypeMetadata) {
            if (this.debug)
                console.warn(`${classContext.name}.${handler.name} is missing the @${RESPONSE_TYPE_KEY} decorator. The response will not be transformed.`);
            return next.handle();
        }

        const {
            type: responseType,
            noTransform,
            response = this.defaultResponse,
            responseKey = this.defaultResponseKey,
            dataKey = this.defaultDataKey
        } = responseTypeMetadata;

        if (noTransform || !responseType) {
            return next.handle().pipe(
                map(data => this.dataToResponse(data, response, responseKey))
            );
        }

        const isArray = Array.isArray(responseType);
        const dtoType = isArray ? responseType[0] : responseType;
        const dtoFilter = this.transformDtoFilter(dtoType);

        return next.handle().pipe(
            map(data => {
                try {
                    const dataObj = this.getDataObject(data, dataKey)
                    if (isArray && !Array.isArray(dataObj)) {
                        throw new TransformError(
                            `Expected an array, but received ${typeof dataObj}`,
                            dtoType.name,
                            responseKey,
                            dataObj,
                            'array',
                            undefined,
                            data,
                            dtoFilter
                        );
                    }
                    if (this.debug) console.time("fast-transform");
                    let transformedData = this.transform(dataObj, dtoFilter, dtoType.name);
                    if (this.debug) console.timeEnd("fast-transform");
                    return this.dataToResponse(transformedData, response, responseKey);
                } catch (error) {
                    throw this.handleError(error);
                }
            }),
            catchError(error => {
                const handledError = this.handleError(error);
                return throwError(() => handledError);
            })
        );
    }

    private transformDtoFilter(DtoClass: Constructor): Record<string, any> {
        if (!dtoCache.has(DtoClass.name)) {
            const metadata = (DtoClass as any)._OPENAPI_METADATA_FACTORY();
            const classNoCheck = Reflect.getMetadata(NO_CHECK_KEY, DtoClass);
            const classNoCheckPrimitives = Reflect.getMetadata(NO_CHECK_PRIMITIVES_KEY, DtoClass);

            const preparedMetadata = this.prepareMetadata(metadata, DtoClass, classNoCheck, classNoCheckPrimitives);
            dtoCache.set(DtoClass.name, preparedMetadata);
        }
        return dtoCache.get(DtoClass.name);
    }

    private prepareMetadata(metadata: any, DtoClass: Constructor, classNoCheck: boolean, classNoCheckPrimitives: boolean): Record<string, any> {
        return Object.entries(metadata).reduce((acc, [key, value]: [string, any]) => {
            const propertyNoCheck = Reflect.getMetadata(NO_CHECK_KEY, DtoClass.prototype, key);
            const propertyNoOut = Reflect.getMetadata(NO_OUT_KEY, DtoClass.prototype, key);

            if (propertyNoOut) {
                return acc;
            }

            acc[key] = this.prepareField(value, classNoCheck || propertyNoCheck, classNoCheckPrimitives);
            return acc;
        }, {});
    }

    private prepareField(value: any, noCheck: boolean, noCheckPrimitives: boolean): any {
        const type = typeof value.type === 'function' ? value.type() : value.type;
        const isNestedObject = typeof type === 'object' && !Array.isArray(type);

        const field = {
            ...value,
            type,
            isEnum: !!value?.enum,
            isPrimitive: false,
            isClass: false,
            isArrayOfClass: false,
            isArrayOfPrimitive: false,
            isNestedObject,
            noCheck,
            expectedType: null,
            metadata: value
        };

        if (isNestedObject) {
            field.nestedFields = this.prepareMetadata(type, Object, noCheck, noCheckPrimitives);
        } else {
            field.isClass = this.isClass(type);
            field.isArrayOfClass = Array.isArray(type) && this.isClass(type[0]);
            field.isArrayOfPrimitive = Array.isArray(type) && !this.isClass(type[0]);
            field.isPrimitive = !field.isClass && !field.isArrayOfClass && !field.isArrayOfPrimitive && !field.isEnum && !field.isNestedObject;
        }

        field.typeCheck =
            (field.isPrimitive ? 1 : 0) |
            (field.isClass ? 2 : 0) |
            (field.isArrayOfClass ? 4 : 0) |
            (field.isEnum ? 8 : 0) |
            (field.isArrayOfPrimitive ? 16 : 0) |
            (field.isNestedObject ? 32 : 0);

        if (field.isPrimitive || field.isArrayOfPrimitive) {
            field.expectedType = this.getExpectedTypeName(field.isArrayOfPrimitive ? field.type[0] : field.type);
            if (noCheckPrimitives) {
                field.noCheck = true;
            }
        }

        return field;
    }

    private transform(obj: any, filter: Record<string, any>, dtoName: string): any {
        if (obj == null) {
            return null;
        }

        if (typeof obj.get === 'function') {
            obj = obj.get({ plain: true });
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.transform(item, filter, dtoName));
        }

        const result: Record<string, any> = {};

        for (const [key, value] of Object.entries(filter)) {
            if (!obj.hasOwnProperty(key)) {
                if (!value.noCheck && (value.required || value.isNestedObject)) {
                    throw new TransformError(`Required field '${key}' is missing`, dtoName, key, undefined, undefined, undefined, obj, filter);
                }
                continue;
            }

            if (obj[key] === undefined) {
                if (!value.noCheck && value.required) {
                    throw new TransformError(`Required field '${key}' cannot be undefined`, dtoName, key, undefined, undefined, undefined, obj, filter);
                }
                continue;
            }

            if (obj[key] === null) {
                if (value.noCheck || value.nullable) {
                    result[key] = null;
                    continue;
                } else {
                    throw new TransformError(`Field '${key}' cannot be null`, dtoName, key, null, undefined, undefined, obj, filter);
                }
            }

            result[key] = this.transformField(obj[key], value, `${dtoName}.${key}`);
        }

        return result;
    }

    private transformField(value: any, fieldMetadata: any, fieldPath: string): any {
        if (value === undefined) {
            if (fieldMetadata.required) {
                throw new TransformError(`Required field is missing`, fieldPath, '', value, fieldMetadata.type.name, undefined, value, fieldMetadata);
            }
            return undefined;
        }

        if (value === null && fieldMetadata.nullable) {
            return null;
        }

        if (fieldMetadata.isNestedObject) {
            if (typeof value !== 'object' || value === null) {
                throw new TransformError(`Field should be an object`, fieldPath, '', value, 'object', undefined, value, fieldMetadata);
            }
            const transformedNested = this.transform(value, fieldMetadata.nestedFields, fieldPath);
            for (const [nestedKey, nestedValue] of Object.entries(fieldMetadata.nestedFields)) {
                const nestedFieldPath = `${fieldPath}.${nestedKey}`;
                if (value.hasOwnProperty(nestedKey)) {
                    const validationResult = this.validateFieldType(value[nestedKey], nestedValue, nestedFieldPath);
                    if (!validationResult.isValid) {
                        throw new TransformError(
                            `Invalid type for nested field '${nestedKey}'`,
                            nestedFieldPath,
                            nestedKey,
                            value[nestedKey],
                            validationResult.expectedType,
                            undefined,
                            value,
                            fieldMetadata
                        );
                    }
                } else if (this.isFieldRequired(nestedValue)) {
                    throw new TransformError(
                        `Required nested field '${nestedKey}' is missing`,
                        fieldPath,
                        nestedKey,
                        undefined,
                        undefined,
                        undefined,
                        value,
                        fieldMetadata
                    );
                }
            }
            return transformedNested;
        }

        switch (fieldMetadata.typeCheck) {
            case 1: // isPrimitive
                return this.transformPrimitive(value, fieldMetadata, fieldPath);
            case 2: // isClass
            case 32: // isNestedObject
                if (typeof value !== 'object' || value === null) {
                    throw new TransformError(`Field should be an object`, fieldPath, '', value, 'object', undefined, value, fieldMetadata);
                }
                return this.transform(value, fieldMetadata.isNestedObject ? fieldMetadata.nestedFields : this.transformDtoFilter(fieldMetadata.type), fieldPath);
            case 4: // isArrayOfClass
            case 16: // isArrayOfPrimitive
                if (!Array.isArray(value)) {
                    throw new TransformError(`Field should be an array`, fieldPath, '', value, 'array', undefined, value, fieldMetadata);
                }
                return value.map((item: any, index: number) => {
                    if (item === undefined) {
                        throw new TransformError(`Invalid value in array`, `${fieldPath}[${index}]`, '', item, 'non-undefined', undefined, value, fieldMetadata);
                    }
                    return item === null && fieldMetadata.nullable
                        ? null
                        : fieldMetadata.typeCheck === 4
                            ? this.transform(item, this.transformDtoFilter(fieldMetadata.type[0]), `${fieldPath}[${index}]`)
                            : this.transformPrimitive(item, fieldMetadata, `${fieldPath}[${index}]`);
                });
            case 8: // isEnum
                if (!Object.values(fieldMetadata.enum).includes(value)) {
                    throw new TransformError(`Invalid enum value`, fieldPath, '', value, 'enum', Object.values(fieldMetadata.enum), value, fieldMetadata);
                }
                return value;
            default:
                throw new TransformError(`Unexpected type for field`, fieldPath, '', value, undefined, undefined, value, fieldMetadata);
        }
    }

    private transformPrimitive(value: any, fieldMetadata: any, fieldPath: string): any {
        if (fieldMetadata.noCheck) return value;

        const expectedType = fieldMetadata.expectedType;
        if (!this.validatePrimitiveType(value, expectedType)) {
            try {
                const coercedValue = this.coerceToPrimitiveType(value, expectedType);
                if (!this.validatePrimitiveType(coercedValue, expectedType)) {
                    throw new Error('Coercion failed');
                }
                return coercedValue;
            } catch (error) {
                throw new TransformError(`Field should be a ${expectedType}`, fieldPath, '', value, expectedType, undefined, value, fieldMetadata);
            }
        }
        return value;
    }

    private isClass(func: any): boolean {
        if (typeof func !== 'function') {
            return false;
        }

        const str = Function.prototype.toString.call(func);
        return str.startsWith('class');
    }

    private getExpectedTypeName(type: any): string {
        if (type === Number) return 'number';
        if (type === String) return 'string';
        if (type === Boolean) return 'boolean';
        if (type === BigInt) return 'bigint';
        if (type === Symbol) return 'symbol';
        if (type === Date) return 'date';
        return 'unknown';
    }

    private validatePrimitiveType(value: any, expectedType: string): boolean {
        switch (expectedType) {
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'string':
                return typeof value === 'string';
            case 'boolean':
                return typeof value === 'boolean';
            case 'bigint':
                return typeof value === 'bigint';
            case 'symbol':
                return typeof value === 'symbol';
            case 'date':
                return value instanceof Date && !isNaN(value.getTime());
            default:
                return false;
        }
    }

    private coerceToPrimitiveType(value: any, expectedType: string): any {
        switch (expectedType) {
            case 'number':
                return Number(value);
            case 'string':
                return String(value);
            case 'boolean':
                return Boolean(value);
            case 'bigint':
                return BigInt(value);
            case 'date':
                return new Date(value);
            default:
                return value;
        }
    }

    private validateFieldType(value: any, fieldMetadata: any, fieldPath: string): { isValid: boolean; expectedType?: string } {
        if (!fieldMetadata || typeof fieldMetadata !== 'object') {
            return { isValid: false, expectedType: 'unknown' };
        }

        if (fieldMetadata.noCheck) return { isValid: true };

        let expectedType: string | undefined;
        let isValid = false;

        switch (fieldMetadata.typeCheck) {
            case 1: // isPrimitive
                expectedType = fieldMetadata.expectedType || 'primitive';
                isValid = this.validatePrimitiveType(value, expectedType);
                break;
            case 2: // isClass
            case 32: // isNestedObject
                expectedType = 'object';
                isValid = typeof value === 'object' && value !== null;
                break;
            case 4: // isArrayOfClass
            case 16: // isArrayOfPrimitive
                expectedType = 'array';
                isValid = Array.isArray(value);
                break;
            case 8: // isEnum
                expectedType = 'enum';
                isValid = fieldMetadata.enum && Object.values(fieldMetadata.enum).includes(value);
                break;
            default:
                expectedType = 'unknown';
                isValid = false;
        }

        return { isValid, expectedType };
    }

    private isFieldRequired(fieldMetadata: any): boolean {
        return fieldMetadata && typeof fieldMetadata === 'object' && fieldMetadata.required === true;
    }

    private handleError(error: Error | TransformError): BadRequestException {
        let errorMessage = 'An error occurred while processing the request.';
        let debugInfo = null;

        if (error instanceof BadRequestException) {
            return error;
        } else if (error instanceof TransformError) {
            errorMessage = `Validation error: ${error.message}`;
            if (this.debug) {

                debugInfo = {
                    dtoName: error.dtoName,
                    fieldName: error.fieldName,
                    receivedValue: error.receivedValue,
                    expectedType: error.expectedType,
                    expectedValues: error.expectedValues,
                    fullObject: JSON.parse(JSON.stringify(error.fullObject, (key, value) => {
                        if (value !== null && typeof value === 'object') {
                            return Object.keys(value).reduce((acc, key) => {
                                acc[key] = value[key];
                                return acc;
                            }, {});
                        }
                        return value;
                    }, 2)),
                    filter: error.filter,
                    stack: error.stack,
                };
                errorMessage = `Validation error in ${error.dtoName}: ${error.message}`;
            }
        } else if (error instanceof Error) {
            errorMessage = `Unexpected error: ${error.message}`;
            if (this.debug) {
                debugInfo = {
                    name: error.name,
                    stack: error.stack,
                };
            }
        }

        return new BadRequestException({
            message: errorMessage,
            debug: debugInfo,
        });
    }

    public static clearCache() {
        dtoCache.clear();
    }
}