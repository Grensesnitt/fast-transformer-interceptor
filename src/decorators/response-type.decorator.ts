import { applyDecorators, SetMetadata, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath, ApiResponseSchemaHost } from '@nestjs/swagger';

export const RESPONSE_TYPE_KEY = 'Grensesnitt/ResponseType';

type DtoType = Type<unknown> | [Type<unknown>];

type ResponseTypeOptionsBase = Omit<ApiResponseSchemaHost, 'schema'> & {
    noTransform?: boolean;
    response?: any;
    responseKey?: string;
    dataKey?: string | null;
    additionalProperties?: Record<string, any>;
};

type ResponseTypeOptionsWithTransform = ResponseTypeOptionsBase & {
    noTransform?: false;
    type: DtoType;
};

type ResponseTypeOptionsWithoutTransform = ResponseTypeOptionsBase & {
    noTransform: true;
    type?: DtoType;
};

export type ResponseTypeOptions = ResponseTypeOptionsWithTransform | ResponseTypeOptionsWithoutTransform;

export function ResponseType(options: ResponseTypeOptions) {
    const {
        type,
        noTransform = false,
        status = 200,
        response,
        responseKey = 'data',
        dataKey,
        additionalProperties = {},
        ...apiOptions
    } = options;

    const decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator> = [];

    if (type && !noTransform) {
        // Only add ApiExtraModels if type is provided and noTransform is false
        decorators.push(ApiExtraModels(Array.isArray(type) ? type[0] : type));
    }

    let schema: any = {
        properties: {
            ...additionalProperties
        }
    };

    if (response) {
        // Custom response structure
        schema.properties[responseKey] = type && !noTransform ? buildDataSchema(type) : { type: 'object' };
    } else if (type && !noTransform) {
        // Default structure
        schema.properties.meta = { type: 'object', nullable: true };
        schema.properties.data = buildDataSchema(type);
    } else {
        // When no type is provided or noTransform is true
        schema.properties[responseKey] = { type: 'object' };
    }

    decorators.push(SetMetadata(RESPONSE_TYPE_KEY, {
        type,
        noTransform,
        response,
        responseKey,
        dataKey
    }));

    decorators.push(
        ApiResponse({
            status,
            schema,
            ...apiOptions
        })
    );

    return applyDecorators(...decorators);
}

function buildDataSchema(type: DtoType): any {
    if (Array.isArray(type)) {
        return {
            type: 'array',
            items: { $ref: getSchemaPath(type[0]) }
        };
    } else {
        return { $ref: getSchemaPath(type) };
    }
}